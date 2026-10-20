from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0012_submission_graded_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancesession",
            name="is_test_mode",
            field=models.BooleanField(default=False),
        ),
    ]
