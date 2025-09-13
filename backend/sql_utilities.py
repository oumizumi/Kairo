#!/usr/bin/env python
"""
Kairo Database SQL Utilities

This file contains utility functions for running SQL queries
and performing database operations on the Kairo PostgreSQL database.

Usage:
    python manage.py shell
    >>> exec(open('sql_utilities.py').read())
    >>> print_database_stats()
"""

import os
from django.db import connection
from django.contrib.auth.models import User
from api.models import Course, UserCalendar, CalendarEvent
import psycopg2
from datetime import datetime


def get_database_connection():
    """Get direct psycopg2 connection to the database"""
    try:
        DATABASE_URL = os.environ.get('DATABASE_URL')
        if not DATABASE_URL:
            print("❌ DATABASE_URL not found in environment variables")
            return None
        
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return None


def execute_sql(query, params=None):
    """Execute raw SQL query using Django's connection"""
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, params or [])
            columns = [col[0] for col in cursor.description] if cursor.description else []
            results = cursor.fetchall()
            return {'columns': columns, 'data': results}
    except Exception as e:
        print(f"❌ SQL Error: {e}")
        return None


def print_table_info(table_name):
    """Print information about a specific table"""
    query = """
    SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM information_schema.columns 
    WHERE table_name = %s
    ORDER BY ordinal_position;
    """
    
    result = execute_sql(query, [table_name])
    if result:
        print(f"\n📋 Table: {table_name}")
        print("-" * 60)
        for row in result['data']:
            column, dtype, nullable, default = row
            print(f"{column:20} | {dtype:15} | {nullable:10} | {default or 'None'}")


def print_database_stats():
    """Print comprehensive database statistics - Full Calendar Event Blocks"""
    print("🗄️ KAIRO CALENDAR DATABASE STATISTICS")
    print("=" * 50)
    
    try:
        print(f"Users:              {User.objects.count()}")
        print(f"Courses:            {Course.objects.count()}")
        print(f"Calendar Events:    {UserCalendar.objects.count()}")
        
        # Calendar-specific stats
        print(f"\n📅 Calendar Event Details:")
        
        # Events by recurrence pattern
        recurrence = execute_sql("""
            SELECT recurrence_pattern, COUNT(*) 
            FROM api_usercalendar 
            GROUP BY recurrence_pattern 
            ORDER BY COUNT(*) DESC;
        """)
        if recurrence and recurrence['data']:
            print(f"Recurrence patterns:")
            for row in recurrence['data']:
                pattern, count = row
                print(f"  • {pattern:12} | {count:8} events")
        
        # Popular themes
        themes = execute_sql("SELECT theme, COUNT(*) FROM api_usercalendar GROUP BY theme ORDER BY COUNT(*) DESC LIMIT 3;")
        if themes and themes['data']:
            print(f"\nMost popular theme: {themes['data'][0][0]} ({themes['data'][0][1]} events)")
            
    except Exception as e:
        print(f"❌ Error getting counts: {e}")


def find_courses_by_keyword(keyword):
    """Find courses containing a keyword"""
    query = """
    SELECT code, title, units, description
    FROM api_course
    WHERE title ILIKE %s OR description ILIKE %s OR code ILIKE %s
    ORDER BY code;
    """
    
    pattern = f"%{keyword}%"
    result = execute_sql(query, [pattern, pattern, pattern])
    
    if result and result['data']:
        print(f"\n🔍 Courses matching '{keyword}':")
        print("-" * 60)
        for row in result['data']:
            code, title, units, desc = row
            print(f"{code:10} | {title:40} | {units} units")
    else:
        print(f"No courses found matching '{keyword}'")


def get_full_calendar_event_details(username):
    """Get COMPLETE calendar event blocks for a user"""
    query = """
    SELECT 
        uc.id,
        uc.title,
        uc.day_of_week,
        uc.start_time,
        uc.end_time,
        uc.start_date,
        uc.end_date,
        uc.description,
        uc.professor,
        uc.location,
        uc.recurrence_pattern,
        uc.reference_date,
        uc.theme,
        uc.created_at,
        uc.updated_at
    FROM api_usercalendar uc
    JOIN auth_user u ON uc.user_id = u.id
    WHERE u.username = %s
    ORDER BY 
        CASE uc.day_of_week
            WHEN 'Monday' THEN 1
            WHEN 'Tuesday' THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday' THEN 4
            WHEN 'Friday' THEN 5
            WHEN 'Saturday' THEN 6
            WHEN 'Sunday' THEN 7
        END,
        uc.start_time;
    """
    
    result = execute_sql(query, [username])
    
    if result and result['data']:
        print(f"\n📅 COMPLETE Calendar Event Blocks for {username}:")
        print("=" * 80)
        for i, row in enumerate(result['data'], 1):
            (id, title, day_of_week, start_time, end_time, start_date, end_date, 
             description, professor, location, recurrence_pattern, reference_date, 
             theme, created_at, updated_at) = row
            
            print(f"\n🔸 Event {i} (ID: {id})")
            print(f"   Title: {title}")
            print(f"   Time: {start_time} - {end_time}")
            print(f"   Day: {day_of_week or 'Specific Date'}")
            if start_date:
                print(f"   Date Range: {start_date} to {end_date or 'same day'}")
            if description:
                print(f"   Description: {description}")
            if professor:
                print(f"   Professor: {professor}")
            if location:
                print(f"   Location: {location}")
            print(f"   Recurrence: {recurrence_pattern}")
            if reference_date:
                print(f"   Reference Date: {reference_date}")
            print(f"   Theme: {theme}")
            print(f"   Created: {created_at}")
            print(f"   Updated: {updated_at}")
            
        print(f"\n✅ Total complete event blocks: {len(result['data'])}")
    else:
        print(f"No calendar events found for user '{username}'")


def show_event_structure():
    """Show the complete structure of calendar event blocks"""
    print("\n📋 COMPLETE CALENDAR EVENT BLOCK STRUCTURE")
    print("=" * 60)
    
    query = """
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'api_usercalendar'
    ORDER BY ordinal_position;
    """
    
    result = execute_sql(query)
    if result and result['data']:
        print(f"{'Field':20} | {'Type':15} | {'Nullable':10} | {'Default'}")
        print("-" * 65)
        for row in result['data']:
            column, dtype, nullable, default = row
            print(f"{column:20} | {dtype:15} | {nullable:10} | {default or 'None'}")
    
    print(f"\n💡 Each calendar event is stored as a complete block with:")
    print(f"   • Basic info (title, times, dates)")
    print(f"   • Details (description, professor, location)")
    print(f"   • Scheduling (recurrence pattern, reference dates)")
    print(f"   • Appearance (theme)")
    print(f"   • Metadata (created/updated timestamps)")


def export_user_calendar_blocks(username, format='json'):
    """Export complete calendar event blocks for a user"""
    query = """
    SELECT 
        title, day_of_week, start_time, end_time, start_date, end_date,
        description, professor, location, recurrence_pattern, reference_date, 
        theme, created_at, updated_at
    FROM api_usercalendar uc
    JOIN auth_user u ON uc.user_id = u.id
    WHERE u.username = %s
    ORDER BY created_at;
    """
    
    result = execute_sql(query, [username])
    
    if result and result['data']:
        import json
        from datetime import datetime
        
        events = []
        for row in result['data']:
            event_block = {
                'title': row[0],
                'day_of_week': row[1],
                'start_time': row[2],
                'end_time': row[3],
                'start_date': row[4],
                'end_date': row[5],
                'description': row[6],
                'professor': row[7],
                'location': row[8],
                'recurrence_pattern': row[9],
                'reference_date': row[10],
                'theme': row[11],
                'created_at': str(row[12]),
                'updated_at': str(row[13])
            }
            events.append(event_block)
        
        filename = f"calendar_blocks_{username}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(events, f, indent=2)
        
        print(f"✅ Exported {len(events)} complete calendar event blocks to {filename}")
        return filename
    else:
        print(f"❌ No calendar events found for user '{username}'")
        return None


def analyze_calendar_usage():
    """Analyze complete calendar event block usage patterns"""
    print("\n📊 CALENDAR EVENT BLOCK ANALYSIS")
    print("=" * 50)
    
    # Event complexity analysis
    query = """
    SELECT 
        CASE 
            WHEN description IS NOT NULL AND description != '' THEN 'With Description'
            ELSE 'Basic Event'
        END as complexity,
        COUNT(*) as count
    FROM api_usercalendar
    GROUP BY 
        CASE 
            WHEN description IS NOT NULL AND description != '' THEN 'With Description'
            ELSE 'Basic Event'
        END;
    """
    
    result = execute_sql(query)
    if result and result['data']:
        print("\n📝 Event Complexity:")
        print("-" * 30)
        for row in result['data']:
            complexity, count = row
            print(f"{complexity:20} | {count:8} events")
    
    # Location usage
    query = """
    SELECT 
        CASE 
            WHEN location IS NOT NULL AND location != '' THEN 'Has Location'
            ELSE 'No Location'
        END as has_location,
        COUNT(*) as count
    FROM api_usercalendar
    GROUP BY 
        CASE 
            WHEN location IS NOT NULL AND location != '' THEN 'Has Location'
            ELSE 'No Location'
        END;
    """
    
    result = execute_sql(query)
    if result and result['data']:
        print("\n📍 Location Data:")
        print("-" * 30)
        for row in result['data']:
            has_location, count = row
            print(f"{has_location:20} | {count:8} events")


def show_tables():
    """Show all tables in the database"""
    query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    result = execute_sql(query)
    if result:
        print("\n📋 Database Tables:")
        for row in result['data']:
            print(f"  • {row[0]}")


def help_sql():
    """Show available functions"""
    print("""
🛠️ KAIRO COMPLETE CALENDAR EVENT BLOCK UTILITIES:

📊 Database Analysis:
• print_database_stats() - Calendar-focused database overview
• show_tables() - List all tables  
• analyze_calendar_usage() - Complete event block analysis
• show_event_structure() - Show full event block structure

🔍 Query Functions:
• get_full_calendar_event_details(username) - Complete event blocks
• find_courses_by_keyword(keyword) - Search courses
• execute_sql(query, params) - Run custom SQL

💾 Export Functions:
• export_user_calendar_blocks(username) - Export complete event data

💡 Quick Start:
1. print_database_stats() - See database overview
2. show_event_structure() - See what we store in each event block
3. get_full_calendar_event_details('username') - View complete events
4. export_user_calendar_blocks('username') - Export all event data

🎯 Focus: Complete calendar event blocks with ALL details
    """)


# Show help on import
if __name__ == "__main__":
    help_sql()

print("📚 Complete Calendar Event Block SQL Utilities loaded! Type help_sql() for commands.") 