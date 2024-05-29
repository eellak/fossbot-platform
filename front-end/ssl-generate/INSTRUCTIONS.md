## Generate a self-signed SSL certificate

1) Create domain name and make it to point to your server IP address.

2) Mofidy the following files based on your domain name:
    - front-end/nginx.conf
    - front-end/.env.production
    - docker-compose-production.yml

3) Install the certbot tool:
    ```bash
    sudo apt-get update
    sudo apt-get install certbot
    ```
4) Generate the SSL certificate:
    ```bash
    sudo certbot certonly --standalone -d your-domain-name
    ```
5) Start docker compose production:
    ```bash
    docker-compose -f docker-compose-production.yml up -d
    ```