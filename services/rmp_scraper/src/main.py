import requests
import csv
import os
import pandas as pd
import numpy as np
from fake_useragent import UserAgent

import concurrent.futures

ua = UserAgent()
def fetch_professor_data(professor_id):
    url = 'https://www.ratemyprofessors.com/graphql'
    headers = {
        'Accept': '*/*',
        'Authorization': 'Basic dGVzdDp0ZXN0',
        'User-Agent': ua.random
    }
    data = {
        "query": f"""
            {{
                node(id: "{professor_id}") {{
                    ... on Teacher {{
                        firstName
                        lastName
                        department
                        avgRating
                        avgDifficulty
                        ratings(first: 100) {{
                            edges {{
                                node {{
                                    comment
                                    ratingTags
                                    difficultyRating
                                    grade
                                    helpfulRating
                                    clarityRating
                                }}
                            }}
                        }}
                        teacherRatingTags {{
                            tagName
                            tagCount
                        }}
                    }}
                }}
            }}
        """
    }

    response = requests.post(url, headers=headers, json=data)

    # Check if the request was successful
    if response.status_code == 200:
        return response.json()
    else:
        response.raise_for_status()


def write_to_csv(data, file_name="FinalOutput.csv"):
    # Check if file exists to write headers only once
    file_exists = os.path.isfile(file_name)

    # Extracting data from the JSON
    teacher_data = {
        'First Name': data['data']['node']['firstName'],
        'Last Name': data['data']['node']['lastName'],
        'Avg Difficulty': data['data']['node']['avgDifficulty'],
        'Avg Rating': data['data']['node']['avgRating'],
        'Department': data['data']['node']['department'],
    }
    rating_data = []
    for edge in data['data']['node']['ratings']['edges']:
        rating_data.append({
            'Comment': edge['node']['comment'],
            'Difficulty Rating': edge['node']['difficultyRating'],
            'Grade': edge['node']['grade'],
            'Clarity Rating': edge['node']['clarityRating'],
            'Rating Tags': edge['node']['ratingTags'],

        })

    # Writing to CSV
    with open(file_name, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file,
                                fieldnames=['First Name', 'Last Name', 'Avg Difficulty', 'Avg Rating', 'Department',
                                            'Comment', 'Difficulty Rating', 'Grade', 'Clarity Rating', 'Rating Tags'])

        # Write headers only if the file did not exist
        if not file_exists:
            writer.writeheader()

        for rating in rating_data:
            combined_data = {**teacher_data, **rating}
            writer.writerow(combined_data)


# Let's say you have a list of multiple teacher data:

# replace with your actual data

import concurrent.futures

def fetch_and_write(data_tuple):
    index, teacher_id = data_tuple  # unpack the tuple into index and teacher_id
    try:
        fetched_data = fetch_professor_data(teacher_id)
        write_to_csv(fetched_data)
        print(f"Successfully processed {index + 1}/{len(base64_ids)}: ID {teacher_id}")
    except Exception as e:
        print(f"Failed to fetch data for {index + 1}/{len(base64_ids)}: ID {teacher_id}. Error: {e}")

if __name__ == "__main__":
    df = pd.read_csv('b64.csv')
    base64_ids = df['base64ID'].to_numpy()
    # base64_ids = ['VGVhY2hlci0yNTIyMjg2']
    # Use ThreadPoolExecutor to fetch data in multiple threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:  # adjust max_workers as needed
        executor.map(fetch_and_write, enumerate(base64_ids))
