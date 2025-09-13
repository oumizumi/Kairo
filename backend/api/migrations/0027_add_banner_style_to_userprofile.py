from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0026_alter_calendarevent_theme_alter_usercalendar_theme'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='banner_style',
            field=models.CharField(blank=True, null=True, max_length=50),
        ),
    ]


