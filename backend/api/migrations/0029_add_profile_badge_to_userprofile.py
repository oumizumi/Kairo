from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0028_add_profile_mode_to_userprofile'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='profile_badge',
            field=models.CharField(blank=True, null=True, max_length=10),
        ),
    ]


