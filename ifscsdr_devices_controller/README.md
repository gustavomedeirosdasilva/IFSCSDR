# IFSCSDR

## Install

First install rtl-sdr, python3 and pip3 in your system.

After install requirements:
```
pip3 install -r requirements.txt
```

Change config.json file:
```
{
    "server": "ifscsdr_server_address",
    "port": 5000
}
```

For more than one dongle you need use differents serial number.
```
rtl_eeprom -d [device index] -s [serial number]
```

Run:
```
python3 __init__.py
```

## Basic operation

Control messages are send by TCP using default port 5000.
Dongles raw data are send by UDP using default port begin 33333 (Dongle 1 -> 33333, Dongle 2 -> 33334, ...).

Devices controller state machine:
```
                          try to
          .-------.       connect       .--------------------------.
          | START | --.   failed .----> | WAIT TO RETRY TO CONNECT |
          `-------´    \        /       `--------------------------´
                        v      |            /
                     .----------------. <--´
       Send     .--> | TRY TO CONNECT | --.
       event   /     `----------------´    \ Is connected to server
       failed /                     ^       \
             /                 Send  \       v
  .------------.               serial \    .---------------------.
  | SEND EVENT | --.           devices `-- | SEND SERIAL DEVICES |
  `------------´    \          failed      `---------------------´
        ^            \                           /
         \            v                         /
 There is \           .------------------.     /
 A dongle  \----------| TRY TO RECV DATA | <--´
 USB event |       .> `------------------´
           |     .´           |    ^    /
           |    /             ;     `--´ There is not
.-----------------------.    / Recv      data to recv
| APPLY DONGLE SETTINGS | <-´  data
`-----------------------´
```

Flow diagram:
```
             Devices controller                    WebServer
             ------------------                    --------
                     |                                |
      Devices in USB |                                |
                     |                            listening
                     |                                |
                     |<----------- connect ---------->|
                     |devices list ------------------>|
                     |<-------------- devices settings|
       Apply devices |                                |
            settings |                                |
                     |                                |
                     |                                | New web client using device 1
                     |<----- Enable device 1 send data|
                     .                                .
                     .                                .
                     .                                .
   New device in USB |                                |
   serial 2          |                                |
                     |New dongle serial 2------------>|
                     |                                |
                     |                                | Web client exit
                     |<---- Disable device 1 send data|
                     |                                |
                     |                                |
Device 1 was removed |                                |
                     |Removed device 1 -------------->|
                     |                                |
                     |                                |
                     |                                | Admin login
                     |                                | Admin change device 2 settings
                     |<--------- new device 2 settings|
      Apply device 2 |                                |
      settings       |                                |
                     .                                .
                     .                                .
                     .                                .
                     |                                |
                     V                                V
```
