import os
import base64
import re
import webbrowser

# Define folder containing HTML and images
folder_path = './'
html_file = 'GAGAPPQ-3167_sparkmip_no_auto_AL.html'

# Read the HTML file
with open(html_file, 'r', encoding='utf-8') as file:
    html_content = file.read()

# Regex to find base64 images
base64_pattern = r'"data:image/(png|jpg|jpeg);base64,([^"]+)"' # src= / url:
image_count = 0

def replace_images(match):
    global image_count
    # Extract the image type and base64 data
    img_type = match.group(1)
    base64_data = match.group(2)
    
    # Decode the base64 image data
    img_data = base64.b64decode(base64_data)
    
    # Generate new image file name
    img_name = f'{image_count}_1.{img_type}'
    new_img_name = f'{image_count}_2.{img_type}'
    image_count += 1

    # Save the new image
    with open(img_name, 'wb') as img_file:
        img_file.write(img_data)

    # Check if the new image file exists
    if os.path.exists(new_img_name):
        # Read the new image file and encode it to base64
        with open(new_img_name, 'rb') as img_file:
            new_img_data = img_file.read()
            new_base64_data = base64.b64encode(new_img_data).decode('utf-8')
        
        # Return the new base64 data
        return f'"data:image/{img_type};base64,{new_base64_data}"'
    
    return match.group(0)  # Return the original match if the new image doesn't exist

# Replace base64 images with new image references
new_html_content = re.sub(base64_pattern, replace_images, html_content)

# Write the modified HTML back to the file
with open('out.html', 'w', encoding='utf-8') as file:
    file.write(new_html_content)

# webbrowser.open(f'file://out.html')
