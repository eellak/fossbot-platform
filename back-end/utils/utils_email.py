import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Function to send email
def send_email(to_email, subject, body):
    # Email configuration
    sender_email = '*******@gmail.com'
    sender_password = '*****'
    smtp_server = 'smtp.gmail.com'
    smtp_port = 587  # Change to the appropriate port
    
    # Create a MIMEText object to represent the email
    message = MIMEMultipart()
    message['From'] = sender_email
    message['To'] = to_email
    message['Subject'] = subject

    # Add body to email
    message.attach(MIMEText(body, 'plain'))

    # Connect to SMTP server and send email
    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, message.as_string())