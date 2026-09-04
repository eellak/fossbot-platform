
import os
import json
import shutil
import requests
import subprocess
import signal
import sys
import threading
from flask import jsonify, send_file, request
from flask_socketio import emit
from blockly_server.app.db_models.models import Projects
from multiprocessing import Process
from blockly_server.extensions import db, process_manager
from blockly_server.config import Config
import time
import uuid
from blockly_server.app.control_utils.utils import stop_now, execute_blocks, imed_exit, load_parameters, save_parameters, get_all_projects, get_sound_effects
from blockly_server.app.robot.hardware_broker import HardwareBrokerClient, HardwareBrokerProcess

IMX500_YOLO_MODEL = os.getenv(
    'FOSSBOT_IMX500_YOLO_MODEL',
    '/usr/share/imx500-models/imx500_network_yolo11n_pp.rpk',
)
IMX500_FASTDEPTH_MODEL = os.getenv(
    'FOSSBOT_IMX500_FASTDEPTH_MODEL',
    '/usr/share/imx500-models/fossbot_fastdepth.rpk',
)
YOLO_CAMERA_WORKER = '/usr/local/lib/fossbot/yolo11-camera.py'
FASTDEPTH_CAMERA_WORKER = '/usr/local/lib/fossbot/fastdepth-camera.py'
ARUCO_CAMERA_WORKER = '/usr/local/lib/fossbot/aruco-camera.py'
ROAD_CAMERA_WORKER = '/usr/local/lib/fossbot/road-camera.py'


class SocketIOEvents:
    def __init__(self, socketio):
        self.socketio = socketio
        self.menu_process = None
        self.user_script_process = None
        self.user_script_running = threading.Event()
        self.program_lock = threading.RLock()
        self.current_program = None
        self.telemetry_sequence = 0
        self.camera_lock = threading.RLock()
        self.camera_subscribers = set()
        self.camera_pending_frames = {}
        self.camera_process = None
        self.camera_task_running = False
        self.camera_mode = 'normal'
        self.camera_inference_enabled = False
        self.camera_restart_requested = False
        # Stop any menu left by the v1 service before the single-owner broker
        # initializes GPIO and restores the menu in its own process.
        self.kill_existing_oled_scripts()
        self.hardware_broker = HardwareBrokerProcess()
        self.hardware_broker.start()
        self.socketio.start_background_task(self.telemetry_loop)

    def find_python_executable(self):
        py_exec = shutil.which('python3')
        if py_exec is None:
            py_exec = shutil.which('python')
        if py_exec is None:
            py_exec = sys.executable
        return py_exec

    @staticmethod
    def _network_addresses():
        try:
            output = subprocess.check_output(
                ['hostname', '-I'],
                stderr=subprocess.DEVNULL,
                text=True,
            )
            return [
                address
                for address in output.split()
                if address and not address.startswith('127.')
            ]
        except Exception:
            return []

    def kill_existing_oled_scripts(self):
        """
        Kills any previously running oled menu/screen scripts even if this server
        instance didn't start them (e.g. after restart/crash).
        """
        try:
            # graceful first
            subprocess.run(["pkill", "-f", r"oled_(menu|screen)\.py"], check=False)
            time.sleep(0.2)
            # hard kill if needed
            subprocess.run(["pkill", "-9", "-f", r"oled_(menu|screen)\.py"], check=False)
        except Exception as e:
            print("Could not pkill existing oled scripts:", e)

    def start_menu_script(self):
        # The v2 hardware broker permanently owns and restores the OLED menu.
        return

    def stop_menu_script(self):
        # Program state suspends menu drawing without terminating the broker.
        return

    def register_events(self):
        self.socketio.on_event('connection', self.on_connect)
        self.socketio.on_event('disconnection', self.on_disconnect)
        self.socketio.on_event('disconnect', self.on_disconnect)
        self.socketio.on_error()(self.error_handler)
        self.socketio.on_event('get-all-projects', self.handle_get_all_projects)
        self.socketio.on_event('get_sound_effects', self.blockly_get_sound_effects)
        self.socketio.on_event('get_admin_panel_parameters', self.handle_get_admin_panel_parameters)
        self.socketio.on_event('save_parameters', self.handle_save_parameters)
        self.socketio.on_event('projects', self.handle_projects)
        self.socketio.on_event('new_project', self.handle_new_project)
        self.socketio.on_event('delete_project', self.handle_delete_project)
        self.socketio.on_event('edit_project', self.handle_edit_project)
        self.socketio.on_event('script_status', self.handle_script_status)
        self.socketio.on_event('stop_script', self.handle_stop_script)
        self.socketio.on_event('terminal_msgs', self.handle_terminal_msgs)
        self.socketio.on_event('fossbot_status', self.on_fossbot_status)
        self.socketio.on_event('execute_blockly', self.handle_execute_blockly)
        self.socketio.on_event('robot:hello', self.handle_robot_hello)
        self.socketio.on_event('robot:get_state', self.handle_robot_get_state)
        self.socketio.on_event('telemetry:get_snapshot', self.handle_telemetry_snapshot)
        self.socketio.on_event('camera:start', self.handle_camera_start)
        self.socketio.on_event('camera:stop', self.handle_camera_stop)
        self.socketio.on_event('camera:ack', self.handle_camera_ack)
        self.socketio.on_event('program:submit', self.handle_program_submit)
        self.socketio.on_event('program:stop', self.handle_program_stop)
        self.socketio.on_event('interactive:command', self.handle_interactive_command)
        self.socketio.on_event('rc:drive', self.handle_rc_drive)
        self.socketio.on_event('rc:action', self.handle_rc_action)
        self.socketio.on_event('open_audio_folder', self.open_audio_folder)
        self.socketio.on_event('send_xml', self.handle_send_xml)
        self.socketio.on_event('save_xml', self.handle_save_xml)
        self.socketio.on_event('systray_controls', self.handle_systray_controls)

    def on_connect(self, data):
        print("Socket connected, data received:", data)

    def on_disconnect(self, data=None):
        print("Socket disconnected!!, data received:", data)
        try:
            self.remove_camera_subscriber(request.sid)
        except Exception:
            pass
        try:
            HardwareBrokerClient().platform_call('rc_stop', True)
        except Exception:
            pass

    def error_handler(self, e):
        print('Error - socket IO : ', e)

    def handle_get_all_projects(self):
        projects_list = get_all_projects()
        emit('all-projects', {'status': '200', 'data': projects_list})

    def blockly_get_sound_effects(self):
        emit('sound_effects', {'status': 200, 'data': get_sound_effects()})

    def handle_get_admin_panel_parameters(self):
        parameters = load_parameters()
        parameters.pop('simulator_ids')
        emit('parameters', {'status': '200', 'parameters': parameters})

    def handle_save_parameters(self, data):
        try:
            params_values = json.loads(data['parameters'])
            parameters = load_parameters()
            for key, value in parameters.items():
                if key in ['robot_name']:
                    value['value'] = params_values[key]
                elif key in ['rgb_led_type']:
                    value['value'] = params_values[key] == 'true'
                elif key != 'simulator_ids':
                    value['value'] = int(params_values[key])
            save_parameters(parameters)
            emit('save_parameters_result', {'status': '200', 'data': parameters})
        except Exception as e:
            print(e)
            emit('save_parameters_result', {'status': 'error', 'data': 'parameters not saved'})

    def handle_projects(self):
        projects_list = get_all_projects()
        data = jsonify(projects_list)
        emit('projects', { 'status': '200', 'data': data })

    def handle_new_project(self, data):
        title = data['title']
        info = data['info']
        project = Projects(title,info)
        db.session.add(project)
        db.session.commit()
        db.session.refresh(project)
        os.mkdir(os.path.join(Config.PROJECT_DIR,f'{project.project_id}'))
        shutil.copy(os.path.join(Config.APP_DIR,'assets/code_templates/template.xml'),os.path.join(Config.PROJECT_DIR,f'{project.project_id}/{project.project_id}.xml'))
        emit('new_project_result', { 'status': '200', 'project_id': project.project_id })

    def handle_delete_project(self, data):
        try:
            project_id = data['project_id']
            project = Projects.query.get(project_id)
            db.session.delete(project)
            db.session.commit()
            shutil.rmtree(os.path.join(Config.PROJECT_DIR,f'{project.project_id}'))
            emit('delete_project_result', {'status':'200', 'project_deleted': 'true' })
        except Exception as e:
            print(e)
            emit('delete_project_result', {'status':'error', 'project_deleted': 'false'})

    def handle_edit_project(self, project_id):
        try:
            project = Projects.query.get(project_id)
            project.title = request.args.get('title')
            project.info = request.args.get('info')
            db.session.commit()
            emit('edit_project', {'status':'updated'})
        except Exception as e:
            print(e)
            emit('edit_project', {'status':'error'})

    def handle_script_status(self):
        if self.user_script_process is None or not self.user_script_process.is_alive():
            emit('script_status', {'status': 'completed'})
        else:
            emit('script_status', {'status': 'still running'})

    def handle_stop_script(self):
        result = self.stop_current_program('platform')
        emit('stop_script', result)

    def handle_terminal_msgs(self, data):
        self.socketio.emit('trm', data)
        stream = 'stderr' if data.get('stream') == 'stderr' else 'stdout'
        self.socketio.emit('program:%s' % stream, {
            'programId': data.get('programId'),
            'line': str(data.get('data', '')),
            'stream': stream,
            'timestamp': int(time.time() * 1000),
        }, namespace='/')

    def relay_to_robot(self, packet):
        self.socketio.emit('execute_fossbot', packet)
        self.socketio.emit('get_fossbot_status')

    def on_fossbot_status(self, data):
        print("FossBot status: ", data)

    def handle_execute_blockly(self, data):
        self.relay_to_robot(json.dumps(data))
        self.socketio.emit('execute_blockly_robot', {'status': '200', 'result': 'Code saved with success'})
        try:
            program = self.submit_program({
                'programId': data.get('request_id'),
                'source': data['code'],
                'origin': data.get('filename', 'legacy'),
            })
            emit('execute_blockly_result', {
                'status': '200',
                'request_id': program['programId'],
            })
        except Exception as e:
            print(e)
            emit('execute_blockly_result', {'status': '400', 'error': str(e)})

    def wait_for_script_completion(self, process, program_id):
        while process.is_alive():
            self.socketio.sleep(0.1)
        process.join(timeout=0)
        with self.program_lock:
            if not self.current_program or self.current_program['programId'] != program_id:
                return
            if self.current_program['state'] in ('stopping', 'stopped'):
                return
            state = 'completed' if process.exitcode == 0 else 'failed'
            self.current_program['state'] = state
            self.current_program['exitCode'] = process.exitcode
            self.current_program['finishedAt'] = int(time.time() * 1000)
            payload = dict(self.current_program)
            self.user_script_running.clear()
            process_manager.set_process(None)
        HardwareBrokerClient().platform_call('stop')
        HardwareBrokerClient().platform_call(
            'set_program_state', state, program_id, payload.get('origin'),
            {'exitCode': process.exitcode},
        )
        self.socketio.emit('program:%s' % state, payload, namespace='/')

    def submit_program(self, data):
        source = str(data.get('source', ''))
        if not source.strip():
            raise ValueError('Program source is empty')
        program_id = str(data.get('programId') or uuid.uuid4())
        origin = str(data.get('origin') or 'unknown')
        if self.user_script_process and self.user_script_process.is_alive():
            self.stop_current_program('replaced')

        now = int(time.time() * 1000)
        program = {
            'programId': program_id,
            'origin': origin,
            'state': 'accepted',
            'acceptedAt': now,
        }
        with self.program_lock:
            self.current_program = program
        self.socketio.emit('program:accepted', dict(program), namespace='/')
        HardwareBrokerClient().platform_call('set_program_state', 'starting', program_id, origin)

        process = Process(target=execute_blocks, args=(source, program_id), daemon=True)
        process.start()
        self.user_script_process = process
        process_manager.set_process(process)
        self.user_script_running.set()
        with self.program_lock:
            program['state'] = 'running'
            program['startedAt'] = int(time.time() * 1000)
            payload = dict(program)
        HardwareBrokerClient().platform_call('set_program_state', 'running', program_id, origin)
        self.socketio.emit('program:started', payload, namespace='/')
        self.socketio.start_background_task(
            self.wait_for_script_completion, process, program_id
        )
        return payload

    def stop_current_program(self, reason):
        with self.program_lock:
            current = self.current_program
            if not current or not self.user_script_process or not self.user_script_process.is_alive():
                HardwareBrokerClient().platform_call('stop')
                return {'status': 'nothing running'}
            current['state'] = 'stopping'
            payload = dict(current)
        HardwareBrokerClient().platform_call(
            'set_program_state', 'stopping', payload['programId'], payload.get('origin')
        )
        self.socketio.emit('program:stopping', payload, namespace='/')
        result = stop_now()
        with self.program_lock:
            current['state'] = 'stopped'
            current['stopReason'] = reason
            current['finishedAt'] = int(time.time() * 1000)
            payload = dict(current)
            self.user_script_running.clear()
        HardwareBrokerClient().platform_call(
            'set_program_state', 'stopped', payload['programId'], payload.get('origin'),
            {'stopReason': reason},
        )
        self.socketio.emit('program:stopped', payload, namespace='/')
        return result

    def get_state(self):
        snapshot = HardwareBrokerClient().platform_call('telemetry')
        snapshot['protocolVersion'] = '1.0'
        snapshot['agentVersion'] = '2.6.0'
        return snapshot

    def telemetry_loop(self):
        while True:
            try:
                snapshot = self.get_state()
                self.telemetry_sequence += 1
                snapshot['sequence'] = self.telemetry_sequence
                if snapshot.pop('physicalStopRequested', False):
                    self.stop_current_program('physical_button')
                self.socketio.emit('telemetry:update', snapshot, namespace='/')
            except Exception as error:
                print('Telemetry error:', error, flush=True)
            self.socketio.sleep(0.5)

    def camera_loop(self):
        with self.camera_lock:
            camera_mode = self.camera_mode
        inference_enabled = camera_mode == 'objects'
        stream_width = 512
        stream_height = 288
        if camera_mode == 'objects':
            if not (
                os.path.isfile(IMX500_YOLO_MODEL)
                and os.path.isfile(YOLO_CAMERA_WORKER)
            ):
                with self.camera_lock:
                    self.camera_task_running = False
                    subscribers = tuple(self.camera_subscribers)
                for sid in subscribers:
                    self.socketio.emit(
                        'camera:status',
                        {
                            'streaming': False,
                            'inference': True,
                            'error': (
                                'The IMX500 YOLO11n model or camera worker '
                                'is not installed.'
                            ),
                        },
                        to=sid,
                        namespace='/',
                    )
                return
            command = [
                YOLO_CAMERA_WORKER,
                '--model', IMX500_YOLO_MODEL,
                '--width', str(stream_width),
                '--height', str(stream_height),
                '--framerate', '15',
            ]
        elif camera_mode == 'depth':
            if not (
                os.path.isfile(IMX500_FASTDEPTH_MODEL)
                and os.path.isfile(FASTDEPTH_CAMERA_WORKER)
            ):
                with self.camera_lock:
                    self.camera_task_running = False
                    subscribers = tuple(self.camera_subscribers)
                for sid in subscribers:
                    self.socketio.emit(
                        'camera:status',
                        {
                            'streaming': False,
                            'mode': 'depth',
                            'inference': False,
                            'error': (
                                'The IMX500 FastDepth model or camera worker '
                                'is not installed.'
                            ),
                        },
                        to=sid,
                        namespace='/',
                    )
                return
            # The depth worker places RGB and depth side by side.
            stream_width = 1024
            command = [
                FASTDEPTH_CAMERA_WORKER,
                '--model', IMX500_FASTDEPTH_MODEL,
                '--width', '512',
                '--height', str(stream_height),
                '--framerate', '12',
            ]
        elif camera_mode == 'aruco':
            if not os.path.isfile(ARUCO_CAMERA_WORKER):
                with self.camera_lock:
                    self.camera_task_running = False
                    subscribers = tuple(self.camera_subscribers)
                for sid in subscribers:
                    self.socketio.emit(
                        'camera:status',
                        {
                            'streaming': False,
                            'mode': 'aruco',
                            'inference': False,
                            'error': 'The ArUco camera worker is not installed.',
                        },
                        to=sid,
                        namespace='/',
                    )
                return
            command = [
                ARUCO_CAMERA_WORKER,
                '--width', '512',
                '--height', '288',
                '--framerate', '15',
                '--dictionary', 'DICT_4X4_50',
            ]
        elif camera_mode == 'road':
            if not os.path.isfile(ROAD_CAMERA_WORKER):
                with self.camera_lock:
                    self.camera_task_running = False
                    subscribers = tuple(self.camera_subscribers)
                for sid in subscribers:
                    self.socketio.emit(
                        'camera:status',
                        {
                            'streaming': False,
                            'mode': 'road',
                            'inference': False,
                            'error': 'The black-tape road camera worker is not installed.',
                        },
                        to=sid,
                        namespace='/',
                    )
                return
            command = [
                ROAD_CAMERA_WORKER,
                '--width', '512',
                '--height', '288',
                '--framerate', '15',
            ]
        else:
            command = [
                '/usr/bin/rpicam-vid',
                '--timeout', '0',
                '--nopreview',
                '--codec', 'mjpeg',
                '--width', '512',
                '--height', '288',
                '--framerate', '15',
                '--quality', '50',
                '--buffer-count', '2',
                '--denoise', 'cdn_off',
                '--flush',
                '--output', '-',
            ]
        process = None
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                bufsize=0,
            )
            with self.camera_lock:
                self.camera_process = process
            buffer = bytearray()
            while process.poll() is None:
                with self.camera_lock:
                    subscribers = tuple(self.camera_subscribers)
                if not subscribers:
                    break
                chunk = process.stdout.read(32768)
                if not chunk:
                    break
                buffer.extend(chunk)
                while True:
                    start = buffer.find(b'\xff\xd8')
                    if start < 0:
                        if len(buffer) > 1:
                            del buffer[:-1]
                        break
                    end = buffer.find(b'\xff\xd9', start + 2)
                    if end < 0:
                        if start:
                            del buffer[:start]
                        if len(buffer) > 2_000_000:
                            buffer.clear()
                        break
                    frame = bytes(buffer[start:end + 2])
                    del buffer[:end + 2]
                    packet = {
                        'jpeg': frame,
                        'timestamp': int(time.time() * 1000),
                        'width': stream_width,
                        'height': stream_height,
                        'inference': inference_enabled,
                        'mode': camera_mode,
                    }
                    now = time.monotonic()
                    with self.camera_lock:
                        ready_subscribers = []
                        for sid in subscribers:
                            pending = self.camera_pending_frames.setdefault(sid, [])
                            pending[:] = [
                                sent_at for sent_at in pending
                                if now - sent_at < 0.75
                            ]
                            if len(pending) < 2:
                                ready_subscribers.append(sid)
                        for sid in ready_subscribers:
                            self.camera_pending_frames[sid].append(now)
                    for sid in ready_subscribers:
                        self.socketio.emit('camera:frame', packet, to=sid, namespace='/')
                    self.socketio.sleep(0)
        except Exception as error:
            with self.camera_lock:
                subscribers = tuple(self.camera_subscribers)
            for sid in subscribers:
                self.socketio.emit(
                    'camera:status',
                    {'streaming': False, 'error': str(error)},
                    to=sid,
                    namespace='/',
                )
        finally:
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=1)
            with self.camera_lock:
                self.camera_process = None
                self.camera_task_running = False
                subscribers = tuple(self.camera_subscribers)
                restart = bool(subscribers and self.camera_restart_requested)
                self.camera_restart_requested = False
                if restart:
                    self.camera_task_running = True
            if restart:
                threading.Thread(target=self.camera_loop, daemon=True).start()
            else:
                for sid in subscribers:
                    self.socketio.emit(
                        'camera:status',
                        {
                            'streaming': False,
                            'inference': self.camera_mode == 'objects',
                            'mode': self.camera_mode,
                        },
                        to=sid,
                        namespace='/',
                    )

    def remove_camera_subscriber(self, sid):
        with self.camera_lock:
            self.camera_subscribers.discard(sid)
            self.camera_pending_frames.pop(sid, None)
            process = self.camera_process if not self.camera_subscribers else None
        if process is not None and process.poll() is None:
            process.terminate()

    def handle_camera_start(self, data=None):
        sid = request.sid
        data = data or {}
        requested_mode = str(data.get('mode', '')).lower()
        if requested_mode not in ('normal', 'objects', 'depth', 'aruco', 'road'):
            requested_mode = (
                'objects'
                if bool(data.get('inference', self.camera_inference_enabled))
                else 'normal'
            )
        requested_inference = requested_mode == 'objects'
        process_to_restart = None
        with self.camera_lock:
            self.camera_subscribers.add(sid)
            self.camera_pending_frames.pop(sid, None)
            if requested_mode != self.camera_mode:
                self.camera_mode = requested_mode
                self.camera_inference_enabled = requested_inference
                if self.camera_task_running:
                    self.camera_restart_requested = True
                    process_to_restart = self.camera_process
            if not self.camera_task_running:
                self.camera_task_running = True
                threading.Thread(target=self.camera_loop, daemon=True).start()
        if process_to_restart is not None and process_to_restart.poll() is None:
            process_to_restart.terminate()
        emit('camera:status', {
            'streaming': True,
            'width': 1024 if requested_mode == 'depth' else 512,
            'height': 288,
            'framerate': 12 if requested_mode == 'depth' else 15,
            'inference': requested_inference,
            'mode': requested_mode,
            'model': (
                'YOLO11n'
                if requested_mode == 'objects'
                else 'FastDepth'
                if requested_mode == 'depth'
                else 'ArUco DICT_4X4_50'
                if requested_mode == 'aruco'
                else 'Black tape road'
                if requested_mode == 'road'
                else None
            ),
            'restarting': process_to_restart is not None,
        })

    def handle_camera_stop(self):
        self.remove_camera_subscriber(request.sid)
        emit('camera:status', {'streaming': False})

    def handle_camera_ack(self, data=None):
        with self.camera_lock:
            pending = self.camera_pending_frames.get(request.sid)
            if pending:
                pending.pop(0)
            if not pending:
                self.camera_pending_frames.pop(request.sid, None)

    def handle_robot_hello(self, data=None):
        state = self.get_state()
        emit('robot:hello', {
            'protocolVersion': '1.0',
            'agentVersion': '2.6.0',
            'robotId': os.uname().nodename,
            'name': os.uname().nodename,
            'addresses': self._network_addresses(),
            'capabilities': [
                'programs', 'interactive', 'rc', 'telemetry', 'oled-menu', 'camera',
                *(
                    ['object-detection']
                    if (
                        os.path.isfile(IMX500_YOLO_MODEL)
                        and os.path.isfile(YOLO_CAMERA_WORKER)
                    )
                    else []
                ),
                *(
                    ['depth-estimation']
                    if (
                        os.path.isfile(IMX500_FASTDEPTH_MODEL)
                        and os.path.isfile(FASTDEPTH_CAMERA_WORKER)
                    )
                    else []
                ),
                *(
                    ['aruco']
                    if os.path.isfile(ARUCO_CAMERA_WORKER)
                    else []
                ),
                *(
                    ['road-detection']
                    if os.path.isfile(ROAD_CAMERA_WORKER)
                    else []
                ),
            ],
            'state': state,
        })

    def handle_robot_get_state(self):
        emit('robot:state', self.get_state())

    def handle_telemetry_snapshot(self):
        emit('telemetry:snapshot', self.get_state())

    def handle_program_submit(self, data):
        try:
            program = self.submit_program(data or {})
            emit('program:submit:result', {'accepted': True, **program})
        except Exception as error:
            emit('program:submit:result', {'accepted': False, 'error': str(error)})

    def handle_program_stop(self, data=None):
        result = self.stop_current_program((data or {}).get('reason', 'platform'))
        emit('program:stop:result', result)

    def handle_interactive_command(self, data):
        command = str((data or {}).get('command', ''))
        programs = {
            'forward': 'robot.motor_left.set_speed(25)\nrobot.motor_right.set_speed(25)\nrobot.move_forward_default()',
            'reverse': 'robot.motor_left.set_speed(25)\nrobot.motor_right.set_speed(25)\nrobot.move_reverse_default()',
            'left': 'robot.rotate_degrees(90, clockwise=False, speed=25)',
            'right': 'robot.rotate_degrees(90, clockwise=True, speed=25)',
            'light-on': 'robot.rgb_set_color("white")\nrobot.wait(1)',
            'light-off': 'robot.rgb_set_color("off")',
            'stop': 'robot.stop()',
        }
        if command not in programs:
            emit('interactive:command:result', {'accepted': False, 'error': 'Unknown command'})
            return
        try:
            program = self.submit_program({
                'programId': (data or {}).get('commandId'),
                'source': programs[command],
                'origin': 'interactive',
            })
            emit('interactive:command:result', {'accepted': True, **program})
        except Exception as error:
            emit('interactive:command:result', {'accepted': False, 'error': str(error)})

    def handle_rc_drive(self, data):
        try:
            if self.user_script_process and self.user_script_process.is_alive():
                raise RuntimeError('Stop the running program before enabling RC mode')
            throttle = max(-1.0, min(1.0, float((data or {}).get('throttle', 0))))
            steering = max(-1.0, min(1.0, float((data or {}).get('steering', 0))))
            max_speed = max(25, min(60, int((data or {}).get('maxSpeed', 45))))
            left = throttle + steering
            right = throttle - steering
            scale = max(1.0, abs(left), abs(right))
            HardwareBrokerClient().platform_call(
                'rc_drive', left / scale, right / scale, max_speed
            )
        except Exception as error:
            emit('rc:error', {'error': str(error)})

    def handle_rc_action(self, data):
        action = str((data or {}).get('action', ''))
        try:
            broker = HardwareBrokerClient()
            if action == 'stop':
                result = broker.platform_call('rc_stop', True)
            elif action == 'light-on':
                result = broker.platform_call('rc_light', True)
            elif action == 'light-off':
                result = broker.platform_call('rc_light', False)
            elif action == 'beep':
                result = broker.platform_call('rc_beep')
            else:
                raise ValueError('Unknown RC action')
            emit('rc:action:result', {'accepted': True, **(result or {})})
        except Exception as error:
            emit('rc:action:result', {'accepted': False, 'error': str(error)})

    def open_audio_folder(self):
        os.startfile(os.path.realpath(os.path.join(Config.DATA_DIR, 'sound_effects')))

    def handle_send_xml(self, data):
        try:
            id = data['id']
            with open(os.path.join(Config.PROJECT_DIR, f'{id}/{id}.xml'), "r", encoding="utf8") as myfile:
                xml_data = myfile.readlines()
            emit('send_xml_result', {'status': '200', 'data': xml_data})
        except Exception as e:
            emit('send_xml_result', {'status': 'file not found'})

    def handle_save_xml(self, data):
        try:
            id = data['id']
            code = data['code']
            project = Projects.query.get(id)
            code = code.replace('</xml>', '')
            extra_info = ''.join(['  <project>\n', f'    <title>{project.title}</title>\n', f'    <description>{project.info}</description>\n', '  </project>\n', '</xml>'])
            code += extra_info
            with open(os.path.join(Config.PROJECT_DIR, f'{id}/{id}.xml'), "w", encoding="utf8") as fh:
                fh.write(code)
            emit('save_xml_result', {'status': '200', 'result': 'Code saved with success'})
        except Exception as e:
            emit('save_xml_result', {'status': 'error occured', 'result': 'Code was not saved'})

    def handle_systray_controls(self, message):
        if message['data'] == 'exit':
            self.stop_menu_script()
            imed_exit()
        else:
            print(message)

def register_socketio_events(socketio):
    events = SocketIOEvents(socketio)
    events.register_events()
