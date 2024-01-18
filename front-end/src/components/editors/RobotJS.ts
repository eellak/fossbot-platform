import { Socket } from 'socket.io-client';

export class Fossbot {     
    public socket: Socket;
    public fossbot_name: string;
    public user_id: string;
    public session_id: string;

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
        this.socket.emit('pythonConnect', serializedDict);
    }

    just_move = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "just_move",
            vel_left: 100,
            vel_right: 100,
            direction: "forward"
        };

        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
        
    }

    get_distance = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: 'get_distance'
        }
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
    }


    move_distance = async (dist: DoubleRange) => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: "move_distance",
            vel_left: 100,
            vel_right: 100,
            direction: "forward",
            tar_dist: dist,
        };
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
    
    }

    // get_distance = async () => {
    //     const param = {
    //         user_id: this.user_id,
    //         fossbot_name: this.fossbot_name,
    //         func: 'dist_travelled',
    //         motor_name: 'right_motor'
    //     }
    //     let serializedDict = JSON.stringify(param);
    //     this.socket.emit('clientMessage', serializedDict);
    // }


  }

