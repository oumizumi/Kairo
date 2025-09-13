from django.contrib import admin
from .models import ImportantDate, ExamEvent

# Register your models here.
admin.site.register(ImportantDate)
admin.site.register(ExamEvent)
