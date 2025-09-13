from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0007_migrate_course_data'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='course',
            name='course_code',
        ),
        migrations.RemoveField(
            model_name='course',
            name='credits',
        ),
        migrations.AlterField(
            model_name='course',
            name='code',
            field=models.CharField(max_length=10, unique=True),
        ),
        migrations.AlterField(
            model_name='course',
            name='units',
            field=models.DecimalField(max_digits=3, decimal_places=1),
        ),
    ] 