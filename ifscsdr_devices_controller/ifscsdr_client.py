#!/usr/bin/env python3

import socket
import time
import json
from ifscsdr_control_devices import IFSCSDRControlDevices

class IFSCSDRClient():
    RETRY_TO_CONNECT_TIME  = 5    # in seconds
    RECV_DATA_TIMEOUT      = 1     # in seconds
    RECV_DATA_LENGTH       = 1024  # in bytes

    def __init__(self, server = '127.0.0.1', port = 5000):
        self.__server = server
        self.__port = port
        self.__control_devices = IFSCSDRControlDevices(server, self.__callback_device_event)
        self.__sock = None
        self.__events = []

    def __callback_device_event(self, action, serial_device):
        self.__events.append({'action': action, 'serial': serial_device})

    def __devices_list(self):
        return json.dumps({'devices': self.__control_devices.getSerialDeviceList()})

    def __decodeDataTryToSetDeviceSettings(self, data):
        try:
            data = data.decode('utf-8')
        except:
            None

        try:
            data_d = json.loads(data)
        except:
            print('Warning: data is not a json: ', data)
            return

        if not 'devices_settings' in data_d:
            print('Warning: field "devices_settings" is not in data')
            return

        for dev_settings in data_d['devices_settings']:
            self.__control_devices.setDeviceSettings(dev_settings)

    def runStateMachine(self):
        def START():
            print('START')
            return TRY_TO_CONNECT

        def TRY_TO_CONNECT():
            print('TRY_TO_CONNECT')

            try:
                if self.__sock:
                    del self.__sock

                self.__sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.__sock.connect((self.__server, self.__port))
            except:
                self.__control_devices.stopSendToServerAllDevices()
                return WAIT_TO_RETRY_TO_CONNECT

            return SEND_SERIAL_DEVICES

        def WAIT_TO_RETRY_TO_CONNECT():
            print('WAIT_TO_RETRY_TO_CONNECT')
            time.sleep(self.RETRY_TO_CONNECT_TIME)
            return TRY_TO_CONNECT

        def SEND_SERIAL_DEVICES():
            print('SEND_SERIAL_DEVICES')
            del self.__events[:]
            try:
                device_list = self.__devices_list()
                self.__sock.send(device_list.encode())
            except:
                return TRY_TO_CONNECT

            return TRY_TO_RECV_DATA

        def TRY_TO_RECV_DATA():
            print('TRY_TO_RECV_DATA')
            data = ' '
            try:
                self.__sock.settimeout(self.RECV_DATA_TIMEOUT)
                data = self.__sock.recv(self.RECV_DATA_LENGTH)
            except socket.timeout:
                self.__sock.settimeout(None)
                None
            except:
                return TRY_TO_CONNECT

            self.__sock.settimeout(None)
            if not data:
                return TRY_TO_CONNECT

            if data is not ' ':
                self.__decodeDataTryToSetDeviceSettings(data)

            if len(self.__events) > 0:
                return SEND_EVENT

            return TRY_TO_RECV_DATA


        def SEND_EVENT():
            print('SEND_EVENT')
            if len(self.__events) < 1:
                return TRY_TO_RECV_DATA

            ev = self.__events.pop(0)
            if ev['action'] == 'add':
                data = json.dumps({'device_add': ev['serial']})
                self.__sock.send(data.encode())
            elif ev['action'] == 'remove':
                data = json.dumps({'device_rem': ev['serial']})
                self.__sock.send(data.encode())

            if len(self.__events) > 0:
                return SEND_EVENT
            else:
                return TRY_TO_RECV_DATA


        state = START
        while True:
            state = state()
