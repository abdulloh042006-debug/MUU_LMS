"""OpenAPI integration for the LMS JWT authentication class."""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class LMSJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "api.access.LMSJWTAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
