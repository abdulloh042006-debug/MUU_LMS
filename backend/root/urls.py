from django.contrib import admin
from api.views import ProtectedMediaAPIView
from django.urls import path, include
from .views import health
from django.conf.urls.static import static
from .settings import STATIC_URL, STATIC_ROOT, MEDIA_URL, MEDIA_ROOT
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
urlpatterns = [
    path('media/<path:name>', ProtectedMediaAPIView.as_view()),
    path('admin/', admin.site.urls),
    path('api/health/', health),
    path('api/', include('api.urls'))
]

urlpatterns += static(STATIC_URL, document_root=STATIC_ROOT)
urlpatterns += [
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui')
]
