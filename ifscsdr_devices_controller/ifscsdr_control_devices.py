#!/usr/bin/env python3

import threading
import pyudev
from ifscsdr_device import IFSCSDRDevice
from ifscsdr_device import get_device_serial_addresses

class IFSCSDRControlDevices(threading.Thread):
    def __init__(self, default_server, callback_device_event):
        threading.Thread.__init__(self)

        self.__serial_device_list = get_device_serial_addresses()
        self.__devices = []

        for item in self.__serial_device_list:
            self.__devices.append(IFSCSDRDevice(serial_number = item, server = default_server))

        self.__callback_device_event = callback_device_event

        self.start()

    def __getDevice(self, serial):
        devices_l = [x for x in self.__devices if x.getSerialNumber() == serial]
        if len(devices_l) > 0:
            return devices_l[0]
        else:
            return None

    def __closeDevice(self, serial):
        device = self.__getDevice(serial)
        if not device:
            return
        self.__devices.remove(device)
        del device

    def __openDeviceOnFail(self, new_settings, settings):

        device = self.__getDevice(new_settings['serial'])
        if not device:
            return

        device.open(serial_number = new_settings['serial'])

        if not 'server' in new_settings:
            new_settings['server'] = settings['server_address']

        if not 'port' in new_settings:
            new_settings['port'] = settings['server_port']

        if not 'sample_rate' in new_settings:
            new_settings['sample_rate'] = settings['sample_rate']

        if not 'center_freq' in new_settings:
            new_settings['center_freq'] = settings['center_freq']

        if not 'freq_correction' in new_settings:
            new_settings['freq_correction'] = settings['freq_correction']

        if not 'gain' in new_settings:
            if settings['gain'] != 0:
                new_settings['gain'] = settings['gain']
            else:
                new_settings['gain'] = 'auto'

        self.setDeviceSettings(new_settings)

    def getSerialDeviceList(self):
        return self.__serial_device_list

    def setDeviceSettings(self, settings):
        if not 'serial' in settings:
            return

        device_l = [x for x in self.__devices if x.getSerialNumber() == settings['serial']]
        if len(device_l) < 1:
            return

        device = device_l[0]
        old_settings = device.getDeviceSettings()

        if not 'transmit' in settings:
            settings['transmit'] = device.is_alive()

        if 'server' in settings:
            device.setServer(settings['server'])

        if 'port' in settings:
            device.setPort(settings['port'])

        if 'sample_rate' in settings:
            try:
                device.set_sample_rate(settings['sample_rate'])
            except:
                print('Error in set sample_rate. Reopening the device ', device.getSerialNumber())
                self.__openDeviceOnFail(settings, old_settings)
                return

        if 'center_freq' in settings:
            try:
                device.set_center_freq(settings['center_freq'])
            except:
                print('Error: cannot set center_freq. Reopening the device ', device.getSerialNumber())
                self.__openDeviceOnFail(settings, old_settings)
                return

        if 'freq_correction' in settings:
            is_alive = device.is_alive()
            if is_alive:
                device.stopSendToServer()

            try:
                device.set_freq_correction(settings['freq_correction'])
            except:
                print('Error: cannot set freq_correction. Reopening the device ', device.getSerialNumber())
                self.__openDeviceOnFail(settings, old_settings)
                return

            if is_alive:
                device.startSendToServer()

        if 'gain' in settings:
            try:
                device.set_gain(settings['gain'])
            except:
                print('Error: cannot set gain. Reopening the device ', device.getSerialNumber())
                self.__openDeviceOnFail(settings, old_settings)
                return

        if settings['transmit'] == True: 
            device.startSendToServer()
        elif settings['transmit'] == False:
            device.stopSendToServer()

    def stopSendToServerAllDevices(self):
        for device in self.__devices:
            device.stopSendToServer()

    def run(self):
        context = pyudev.Context()
        monitor = pyudev.Monitor.from_netlink(context)

        def diffList(l1, l2):
            diff = [i for i in l1 + l2 if i not in l1 or i not in l2] 
            return diff

        # enumerate at device connection
        for device in iter(monitor.poll, None):
            if device.action == 'add' and device.device_node:
                serial_numbers = get_device_serial_addresses()
                diff = diffList(self.__serial_device_list, serial_numbers)

                if len(diff) == 0:
                    # Device is not a rtl_sdr
                    continue

                self.__serial_device_list = serial_numbers
                self.__devices.append(IFSCSDRDevice(serial_number = diff[0]))
                self.__callback_device_event('add', diff[0])

            if device.action == 'remove' and device.device_node:
                serial_numbers = get_device_serial_addresses()
                diff = diffList(self.__serial_device_list, serial_numbers)

                if len(diff) == 0:
                    # Device is not a rtl_sdr
                    continue

                if diff[0] == '':
                    # RTL Devices was disconnect almost in the same time.
                    continue

                self.__serial_device_list = serial_numbers
                for item in diff:
                    if item == '':
                        continue
                    self.__closeDevice(item)
                    self.__callback_device_event('remove', item)
