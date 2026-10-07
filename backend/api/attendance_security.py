import hashlib
import hmac
import logging
import time

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import APIException

from .models import AttendanceAttemptWindow

MESSAGES = {
    'already_checked_in': 'Davomat allaqachon tasdiqlangan.',
    'code_expired': 'Kod muddati tugagan. Yangi kodni kiriting.',
    'code_invalid': 'Kod noto‘g‘ri.',
    'session_not_active': 'Davomat sessiyasi faol emas.',
    'not_enrolled': 'Siz ushbu dars guruhiga biriktirilmagansiz.',
    'rate_limited': 'Urinishlar ko‘p. Bir daqiqadan keyin qayta urinib ko‘ring.',
}
ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'


class AttendanceError(APIException):
    def __init__(self, code, status=400):
        self.status_code = status
        super().__init__({'code': code, 'message': MESSAGES[code]})


def manual_code(session_id, bucket=None):
    bucket = int(time.time() // 5) if bucket is None else bucket
    # Two clock characters permit expiry classification without storing plaintext codes.
    prefix = ALPHABET[(bucket // len(ALPHABET)) % len(ALPHABET)] + ALPHABET[bucket % len(ALPHABET)]
    digest = hmac.new(str(settings.SECRET_KEY).encode(), f'manual:{session_id}:{bucket}'.encode(), hashlib.sha256).digest()
    number = int.from_bytes(digest, 'big')
    suffix = ''
    for _ in range(6):
        suffix += ALPHABET[number % len(ALPHABET)]
        number //= len(ALPHABET)
    return prefix + suffix


def validate_manual_code(session_id, value):
    value = value.strip().upper()
    if len(value) != 8 or any(c not in ALPHABET for c in value):
        raise AttendanceError('code_invalid')
    now = time.time()
    current = int(now // 5)
    cycle = len(ALPHABET) ** 2
    encoded = ALPHABET.index(value[0]) * len(ALPHABET) + ALPHABET.index(value[1])
    bucket = current - ((current - encoded) % cycle)
    if not hmac.compare_digest(value, manual_code(session_id, bucket)):
        raise AttendanceError('code_invalid')
    if now - bucket * 5 > 6:
        raise AttendanceError('code_expired')


def consume_attempts(user_id, session_id):
    # Committed before proof validation so rejected requests still consume quota.
    with transaction.atomic():
        window = int(time.time() // 60)
        allowed = True
        for key, limit in ((f'student:{user_id}', 10), (f'session:{session_id}', 120)):
            row, _ = AttendanceAttemptWindow.objects.get_or_create(key=key, defaults={'window': window})
            row = AttendanceAttemptWindow.objects.select_for_update().get(pk=row.pk)
            if row.window != window:
                row.window, row.attempts = window, 0
            row.attempts = min(row.attempts + 1, limit + 1)
            row.save(update_fields=['window', 'attempts'])
            allowed = allowed and row.attempts <= limit
        return allowed


def log_failure(request, code):
    agent = request.META.get('HTTP_USER_AGENT', '')[:512]
    browser = next((name for token, name in [('SamsungBrowser', 'Samsung'), ('Edg/', 'Edge'), ('Firefox', 'Firefox'), ('Chrome', 'Chrome'), ('Safari', 'Safari')] if token in agent), 'Other')
    os = next((name for token, name in [('Android', 'Android'), ('iPhone', 'iOS'), ('iPad', 'iOS'), ('Windows', 'Windows'), ('Macintosh', 'macOS'), ('Linux', 'Linux')] if token in agent), 'Other')
    logging.getLogger('api.attendance').info('attendance_failure reason=%s browser=%s os=%s', code, browser, os)
