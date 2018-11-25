#!/bin/bash

audio_sample_rate=44100
clients_dir="/tmp/ifsc-sdr/clients"

# fft <sample_rate> <fft_size>
function fft()
{
    local sample_rate=$1
    local fft_size=$2

    csdr fft_cc $fft_size `python3 -c "print ($sample_rate/144)"` HAMMING | csdr logaveragepower_cf -70 $fft_size 15 | csdr fft_exchange_sides_ff $fft_size
}

# wfm_demodulator <client_id> <central_frequency> <frequency> <sample_rate> 
function wfm_demodulator()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id
    local central_frequency=$2
    local frequency=$3
    local sample_rate=$4

    csdr shift_addition_cc --fifo $client_dir/fifo_shift_addition_cc | csdr fir_decimate_cc 12 0.05 HAMMING | csdr bandpass_fir_fft_cc --fifo $client_dir/fifo_bandpass_fir_fft_cc 0.008 | csdr fmdemod_quadri_cf | csdr fractional_decimator_ff `python3 -c "print (float($sample_rate)/12/$audio_sample_rate)"` | csdr deemphasis_wfm_ff $audio_sample_rate 75e-6 | csdr convert_f_s16
}

# nfm_demodulator <client_id> <central_frequency> <frequency> <sample_rate> 
function nfm_demodulator()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id
    local central_frequency=$2
    local frequency=$3
    local sample_rate=$4

    csdr shift_addition_cc --fifo $client_dir/fifo_shift_addition_cc | csdr fir_decimate_cc 20 0.005 HAMMING | csdr bandpass_fir_fft_cc --fifo $client_dir/fifo_bandpass_fir_fft_cc 0.002 | csdr fmdemod_quadri_cf | csdr limit_ff | csdr fractional_decimator_ff `python3 -c "print (float($sample_rate)/20/$audio_sample_rate)"` | csdr deemphasis_nfm_ff $audio_sample_rate | csdr fastagc_ff | csdr convert_f_s16
}

# am_demodulator <client_id> <central_frequency> <frequency> <sample_rate> 
function am_demodulator()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id
    local central_frequency=$2
    local frequency=$3
    local sample_rate=$4

    csdr shift_addition_cc --fifo $client_dir/fifo_shift_addition_cc | csdr fir_decimate_cc 20 0.005 HAMMING | csdr bandpass_fir_fft_cc --fifo $client_dir/fifo_bandpass_fir_fft_cc 0.002 | csdr amdemod_cf | csdr fastdcblock_ff | csdr fractional_decimator_ff `python3 -c "print (float($sample_rate)/20/$audio_sample_rate)"` | csdr agc_ff | csdr limit_ff | csdr convert_f_s16
}

# usb_demodulator <client_id> <central_frequency> <frequency> <sample_rate> 
function usb_demodulator()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id
    local central_frequency=$2
    local frequency=$3
    local sample_rate=$4

    csdr shift_addition_cc --fifo $client_dir/fifo_shift_addition_cc | csdr fir_decimate_cc 60 0.005 HAMMING | csdr fractional_decimator_ff `python3 -c "print (float($sample_rate)/60/$audio_sample_rate)"` | csdr bandpass_fir_fft_cc 0 0.1 0.05 | csdr realpart_cf | csdr agc_ff | csdr limit_ff | csdr convert_f_s16
}

# lsb_demodulator <client_id> <central_frequency> <frequency> <sample_rate> 
function lsb_demodulator()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id
    local central_frequency=$2
    local frequency=$3
    local sample_rate=$4

    csdr shift_addition_cc --fifo $client_dir/fifo_shift_addition_cc | csdr fir_decimate_cc 60 0.005 HAMMING | csdr fractional_decimator_ff `python3 -c "print (float($sample_rate)/60/$audio_sample_rate)"` | csdr bandpass_fir_fft_cc -0.1 0 0.05 | csdr realpart_cf | csdr agc_ff | csdr limit_ff | csdr convert_f_s16
}

# new_client <client_id>
function new_client()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id

    mkdir -p $client_dir

    mkfifo $client_dir/fifo_shift_addition_cc
    mkfifo $client_dir/fifo_bandpass_fir_fft_cc
}

# del_client <client_id>
function del_client()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id

    rm -rf $client_dir
}

# change_shift_addition_cc <client_id> <range>
function change_shift_addition_cc()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id
    local range=$2

    if [ -e $client_dir/fifo_shift_addition_cc ]; then
        echo "$range" > $client_dir/fifo_shift_addition_cc
    fi
}

# change_bandpass_fir_fft_cc <client_id> <low_cut> <high_cut>
function change_bandpass_fir_fft_cc()
{
    local client_id=$1
    local client_dir=$clients_dir/$client_id
    local low_cut=$2
    local high_cut=$3

    if [ -e $client_dir/fifo_bandpass_fir_fft_cc ]; then
        echo "$low_cut $high_cut" > $client_dir/fifo_bandpass_fir_fft_cc
    fi
}

# del_dir
function del_dir()
{
    rm -rf $clients_dir
}


case "$1" in
    fft)
        fft "${@:2}"
        ;;

    wfm_demodulator)
        wfm_demodulator "${@:2}"
        ;;

    nfm_demodulator)
        nfm_demodulator "${@:2}"
        ;;

    am_demodulator)
        am_demodulator "${@:2}"
        ;;

    usb_demodulator)
        usb_demodulator "${@:2}"
        ;;

    lsb_demodulator)
        lsb_demodulator "${@:2}"
        ;;

    new_client)
        new_client "${@:2}"
        ;;

    del_client)
        del_client "${@:2}"
        ;;

    change_shift_addition_cc)
        change_shift_addition_cc "${@:2}"
        ;;

    change_bandpass_fir_fft_cc)
        change_bandpass_fir_fft_cc "${@:2}"
        ;;

    del_dir)
        del_dir "${@:2}"
        ;;
    *)
        echo "Usage:"
        echo -e "\t$0 fft <sample_rate> <fft_size>"
        echo -e "\t$0 wfm_demodulator <client_id> <central_frequency> <frequency> <sample_rate>"
        echo -e "\t$0 nfm_demodulator <client_id> <central_frequency> <frequency> <sample_rate>"
        echo -e "\t$0 am_demodulator <client_id> <central_frequency> <frequency> <sample_rate>"
        echo -e "\t$0 usb_demodulator <client_id> <central_frequency> <frequency> <sample_rate>"
        echo -e "\t$0 lsb_demodulator <client_id> <central_frequency> <frequency> <sample_rate>"
        echo -e "\t$0 new_client <client_id>"
        echo -e "\t$0 del_client <client_id>"
        echo -e "\t$0 change_shift_addition_cc <client_id> <range>"
        echo -e "\t$0 change_bandpass_fir_fft_cc <client_id> <low_cut> <high_cut>"
        echo -e "\t$0 del_dir"
        echo -e ""
        exit 1
esac
