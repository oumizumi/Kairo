from django.db import migrations

def migrate_course_data(apps, schema_editor):
    Course = apps.get_model('api', 'Course')
    for course in Course.objects.all():
        # Copy course_code to code
        course.code = course.course_code
        # Convert credits to units
        if course.credits is not None:
            course.units = float(course.credits)
        course.save()

def reverse_migrate_course_data(apps, schema_editor):
    Course = apps.get_model('api', 'Course')
    for course in Course.objects.all():
        # Copy code back to course_code
        course.course_code = course.code
        # Convert units back to credits
        if course.units is not None:
            course.credits = int(course.units)
        course.save()

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0006_alter_course_options_course_code_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_course_data, reverse_migrate_course_data),
    ] 