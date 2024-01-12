import { Socket } from 'socket.io-client';

export default class Fossbot {     
    private socket: Socket;
    private fossbot_name: string;
    private user_id: string;

    constructor(socket: Socket, fossbot_name: string, user_id: string) {
        this.socket = socket;
        this.fossbot_name = fossbot_name;
        this.user_id = user_id;

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

    get_distance = async () => {
        const param = {
            user_id: this.user_id,
            fossbot_name: this.fossbot_name,
            func: 'dist_travelled',
            motor_name: 'right_motor'
        }
        let serializedDict = JSON.stringify(param);
        this.socket.emit('clientMessage', serializedDict);
    }


  }

