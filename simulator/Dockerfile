# Use an official Python runtime as a parent image
FROM python:3.9

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the current directory contents into the container at /usr/src/app
COPY main.py .
COPY requirements.txt .
COPY static/ ./static
COPY templates/ ./templates

# Install any needed packages specified in requirements.txt
RUN pip install -r requirements.txt

# Run app.py when the container launches
#CMD ["gunicorn", "-k", "eventlet", "-w", "1", "--bind", "0.0.0.0:8000", "your_application_module:app"]
CMD ["python", "main.py"]
