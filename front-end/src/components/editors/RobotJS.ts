import { Socket } from 'socket.io-client';

export class Fossbot {     
    public socket: Socket;
    public fossbot_name: string;
    public user_id: string;
    public session_id: string;
    private responseHandler: { [key: string]: (message: any) => void } = {};
    public velocity_right: number = 100;
    public velocity_left: number = 100;

    constructor(socket: Socket, fossbot_name: string, user_id: string,session_id:string) {
        this.socket = socket;
        this.fossbot_name = fossbot_name;
        this.user_id = user_id;        
        this.session_id = session_id;
        this.connect();
    }

    connect = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            session_id: this.session_id
        };
        
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientConnect', serializedDict);

        this.socket.on('clientIncMessage', (message) => {
            console.log('Received message:', message);
            // Handle incoming messages
            const messageData = message;
            const responseData = messageData.data; 
            console.log(messageData);
            if (this.responseHandler[messageData.function]) {
                this.responseHandler[messageData.function](responseData);
                delete this.responseHandler[messageData.function];
            }
        });
        
    }

    waitForResponse = (funcName: string,reponse_value:boolean): Promise<any> => {
        return new Promise((resolve) => {
            this.responseHandler[funcName] = (message) => {
                // Handle response based on the responseType
                if (reponse_value) {                    
                    resolve(message);   
                } else{
                    if (message === "done" || Object.keys(message).length === 0) {
                        resolve("done");                    }
                    
                }
            };
        });
    }

    stop = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "stop"           
        };

        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        await this.waitForResponse(param.func,false);
        
    }
   
    just_move = async (direction="forward") => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "just_move",
            vel_left: this.velocity_left,
            vel_right: this.velocity_right,
            direction: direction
        };

        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        await this.waitForResponse(param.func,false);
        
    }

    just_rotate = async (direction) => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "just_rotate",
            vel_left: this.velocity_left,
            vel_right: this.velocity_right,
            dir_id: direction
        };

        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        await this.waitForResponse(param.func,false);
        
    }

    rotate_90 = async (direction) => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "rotate_90",
            degree: 90,
            vel_left: this.velocity_left,
            vel_right: this.velocity_right,
            dir_id: direction
        };

        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        await this.waitForResponse(param.func,false);
        
    }

    rgb_set_color = async (color) => {
        const colors = ['red', 'green', 'blue', 'white', 'violet', 'cyan', 'yellow', 'closed'];
        if (!colors.includes(color)) {
            console.log('Invalid color');
            return;
        }
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            color : color,
            func: "rgb_set_color", 
             }
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        await this.waitForResponse(param.func,false);
    }

    get_light_sensor = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "get_light_sensor",
        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        return await this.waitForResponse(param.func,true);
    }

    get_floor_sensor = async (sensor_id) => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "get_floor_sensor",
            sensor_id: sensor_id
        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        return await this.waitForResponse(param.func,true);
    }

    get_acceleration = async (axis) => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "get_acceleration",
            axis: axis

        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        return await this.waitForResponse(param.func,true);
    }

    get_gyro = async (axis) => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "get_gyroscope",
            axis: axis

        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        return await this.waitForResponse(param.func,true);
    }

    get_noise_detection = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "get_noise_detection",
        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        return await this.waitForResponse(param.func,true);
    }



    get_distance = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: 'get_distance'
        }
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        return await this.waitForResponse(param.func,true);
    }


    move_distance = async (dist,direction="forward") => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "move_distance",
            vel_left: this.velocity_left,
            vel_right: this.velocity_right,
            direction: direction,
            tar_dist: dist,
        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        await this.waitForResponse(param.func,false);
    }

    play_sound = async (sound_path) => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "play_sound",
            sound_path: sound_path
        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        await this.waitForResponse(param.func,false);
    }


  }

