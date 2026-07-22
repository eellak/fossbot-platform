
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

class SocketIOEvents:
    def __init__(self, socketio):
        self.socketio = socketio
        self.menu_process = None
        self.user_script_process = None
        self.user_script_running = threading.Event()
        self.program_lock = threading.RLock()
        self.current_program = None
        self.telemetry_sequence = 0
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
        snapshot['agentVersion'] = '2.1.0'
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

    def handle_robot_hello(self, data=None):
        state = self.get_state()
        emit('robot:hello', {
            'protocolVersion': '1.0',
            'agentVersion': '2.1.0',
            'robotId': os.uname().nodename,
            'name': os.uname().nodename,
            'capabilities': ['programs', 'interactive', 'rc', 'telemetry', 'oled-menu'],
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
