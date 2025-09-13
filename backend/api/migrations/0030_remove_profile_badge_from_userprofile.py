from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0029_add_profile_badge_to_userprofile'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='userprofile',
            name='profile_badge',
        ),
    ]


