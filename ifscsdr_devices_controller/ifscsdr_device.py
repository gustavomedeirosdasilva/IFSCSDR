#!/usr/bin/env python3

import threading
import socket
from rtlsdr import RtlSdr

class IFSCSDRDevice(RtlSdr, threading.Thread):
    DEFAULT_READ_SIZE = 6*1024

    def __init__(self, server = '127.0.0.1', port = '5000', device_index = 0, serial_number = None):
        super().__init__(device_index = device_index, serial_number = serial_number)
        threading.Thread.__init__(self)

        if serial_number is not None:
            self.__serial_number = serial_number
            self.__device_index = RtlSdr.get_device_index_by_serial(serial_number)
        else:
            self.__serial_number = RtlSdr.get_device_serial_addresses()[device_index]
            self.__device_index = device_index

        self.__port = port
        self.__server = server
        self.__sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    def __del__(self):
        self.stop()

    def __send_samples_cb(self, buf, ctx):
        self.__sock.sendto(buf, (self.__server, self.__port))

    def run(self):
        try:
            self.read_bytes_async(self.__send_samples_cb, self.DEFAULT_READ_SIZE, None)
        except:
            print('Error: read_bytes_async(...) device: ', self.__serial_number)

    def stop(self):
        self.stopSendToServer()
        self.close()

    def stopSendToServer(self):
        if self.is_alive():
            self.cancel_read_async()

    def startSendToServer(self):
        if not self.is_alive():
            try:
                self.start()
            except:
                threading.Thread.__init__(self)
                self.start()

    def getSerialNumber(self):
        return self.__serial_number

    def getDeviceIndex(self):
        return self.__device_index

    def setServer(self, server = '127.0.0.1'):
        self.__server = server

    def getServer(self):
        return self.__server

    def setPort(self, port = 5000):
        self.__port = port

    def getPort(self):
        return self.__port

    def getDeviceSettings(self):
        d = {
                'device_index': self.__device_index,
                'serial_number': self.__serial_number,
                'sample_rate': self.get_sample_rate(),
                'center_freq': self.get_center_freq(),
                'freq_correction': self.get_freq_correction(),
                'gain': self.get_gain(),

                'supported_gains': self.get_gains(),
                'bandwidth': self.get_bandwidth(),
                'tuner_type': self.get_tuner_type(),
                'server_address': self.__server,
                'server_port': self.__port,
                'transmit': self.is_alive()
            }

        return d


def get_device_serial_addresses():
    return RtlSdr.get_device_serial_addresses()
