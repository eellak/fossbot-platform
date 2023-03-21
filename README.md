![](images/superlogo.png)

![](images/gfoss_en.png)
![](images/hua_en.png)
## Fossbot Application
![](images/screen1.png)

## For the Simulator 
### Installation
1) Download the latest release for your system (Windows, Ubuntu, MacOS) from the Releases section
2) Unzip
3) Install the Coppelia Simulator (EDU or Player) ```https://www.coppeliarobotics.com/downloads```


### Usage
1) Start the Coppelia Simulator
2) Load a scene and start the simulation using the play button from top 
3) Start the ```FossBot Simulator``` app
4) Enjoy!



## For the Physical robot 
### Installation
0) Activate the fully assembly FOSSBot and conect with ssh
1) Install the docker on your Raspberry Pi
2) Copy the docker-compose.yaml to the root directory
3) Run ```docker compose -f docker-compose.yaml up -d```

### Usage
1) Connect throught your broswer to http://<Raspberry Pi ip>:8081
2) Enjoy!

## Screenshots
![](images/screen3.png)
![](images/screen2.png)



## Software Development Team
* Christos Chronis
* Eleftheria Papageorgiou
* Manousos Linardakis

## Builds
[![Build Windows app](https://github.com/chronis10/fossbot-app/actions/workflows/windows_app.yml/badge.svg)](https://github.com/chronis10/fossbot-app/actions/workflows/windows_app.yml)

[![Build MacOS app](https://github.com/chronis10/fossbot-app/actions/workflows/macos_app.yml/badge.svg)](https://github.com/chronis10/fossbot-app/actions/workflows/macos_app.yml)

[![Build Ubuntu app](https://github.com/chronis10/fossbot-app/actions/workflows/ubuntu_app.yml/badge.svg)](https://github.com/chronis10/fossbot-app/actions/workflows/ubuntu_app.yml)

[![Docker Build Robot image](https://github.com/chronis10/fossbot-app/actions/workflows/Robot%20Image.yml/badge.svg)](https://github.com/chronis10/fossbot-app/actions/workflows/Robot%20Image.yml)

