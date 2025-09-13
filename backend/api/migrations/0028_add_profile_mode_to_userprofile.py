from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0027_add_banner_style_to_userprofile'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='profile_mode',
            field=models.CharField(blank=True, null=True, max_length=50),
        ),
    ]


