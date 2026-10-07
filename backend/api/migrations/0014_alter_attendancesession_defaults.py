from django.db import migrations, models
from django.core.validators import MaxValueValidator, MinValueValidator


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0013_attendancesession_is_test_mode"),
    ]

    operations = [
        migrations.AlterField(
            model_name="attendancesession",
            name="attendance_minutes",
            field=models.PositiveSmallIntegerField(
                default=60,
                validators=[MinValueValidator(2), MaxValueValidator(60)],
            ),
        ),
        migrations.AlterField(
            model_name="attendancesession",
            name="late_after_minutes",
            field=models.PositiveSmallIntegerField(
                default=2,
                validators=[MinValueValidator(1), MaxValueValidator(59)],
            ),
        ),
    ]
