import pandas as pd
import base64

# Read the CSV without headers
df = pd.read_csv('./names.csv', header=None)

# Delete the first row (old header)
df = df.iloc[1:]

# Assign new headers
df.columns = ['Name', 'ID']

# Filter and process the DataFrame
df = df[df['ID'] != "Not Found"].dropna(how='all').reset_index(drop=True)
df['base64ID'] = df['ID'].apply(lambda x: base64.b64encode(('Teacher-' + str(x)).encode()).decode())

# Write the DataFrame to a new CSV file
df.to_csv('b64.csv', index=False)
