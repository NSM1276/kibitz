"""Generate the synthesized game sounds in assets/sfx.

clack1..6  pool ball on ball: phenolic resin balls give a short, dry "tock" with no ringing
           (the old Kenney take had a narrow 8 kHz resonance that read as steel).
throw1..4  a card thrown onto the cloth: air swish + soft slap (slap from BMacZero CC0 "contact").
deal1..4   lighter, shorter version for dealing.
Run:  python tools/gen_sfx.py <path to dir with contact1.wav contact2.wav>   (needs numpy, scipy, ffmpeg)
"""
import os, subprocess, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
rng = np.random.default_rng(7)


def norm(x, peak=0.9):
    return x / (np.max(np.abs(x)) + 1e-9) * peak


def write_mp3(name, x):
    tmp = os.path.join(OUT, name + '.wav')
    wavfile.write(tmp, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-b:a', '96k', os.path.join(OUT, name + '.mp3')], check=True)
    os.remove(tmp)


def resonator(x, f, decay_ms):
    """two-pole resonator: rings at f, amplitude falls to 1/e after decay_ms"""
    r = np.exp(-1000.0 / (decay_ms * SR))
    w = 2 * np.pi * f / SR
    return signal.lfilter([1 - r], [1, -2 * r * np.cos(w), r * r], x)


def clack(tau_ms, body_f, seed):
    g = np.random.default_rng(seed)
    n = int(SR * 0.16)
    t = np.arange(n) / SR
    # contact force of two hard spheres ~ half sine of width tau; the radiated sound of a rigid body
    # follows its acceleration change, i.e. the derivative of the force pulse
    tau = tau_ms / 1000
    f = np.where(t < tau, np.sin(np.pi * t / tau), 0.0)
    click = np.gradient(f)
    # a little short-lived body colour around 2-3.5 kHz gives the wooden-ish "tock" of resin balls
    tock = resonator(click, body_f, 2.2) * 0.9 + resonator(click, body_f * 1.62, 1.4) * 0.45
    x = click * 0.6 + tock
    # second ball's contribution, a hair later and different
    d = int(SR * g.uniform(0.00008, 0.0002))
    x[d:] += 0.35 * resonator(click, body_f * g.uniform(0.9, 1.1), 1.8)[: n - d]
    # room: very quiet, short tail (felt table, indoor)
    tail = g.standard_normal(n) * np.exp(-t / 0.035) * 0.025
    tail = signal.lfilter(*signal.butter(2, [600 / (SR / 2), 5000 / (SR / 2)], 'band'), tail)
    x = norm(x) + tail * (np.max(np.abs(x)) > 0)
    x *= np.minimum(1, (n - np.arange(n)) / (SR * 0.02))  # fade out
    return norm(x, 0.95)


def swish(dur, f0, f1, seed, level=1.0):
    g = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.linspace(0, 1, n)
    noise = g.standard_normal(n)
    # sweep a band-pass through the noise: the card cutting the air
    out = np.zeros(n)
    blk = 256
    zi = None
    fc = f0 + (f1 - f0) * np.sin(np.pi * t * 0.5)
    for i in range(0, n, blk):
        c = fc[i]
        b, a = signal.butter(2, [max(200, c * 0.55) / (SR / 2), min(16000, c * 1.6) / (SR / 2)], 'band')
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        seg, zi = signal.lfilter(b, a, noise[i:i + blk], zi=zi)
        out[i:i + blk] = seg
    env = np.sin(np.pi * np.clip(t, 0, 1)) ** 1.6 * (0.4 + 0.6 * t)
    return norm(out * env, 0.5 * level)


def load_wav(p):
    sr, y = wavfile.read(p)
    y = y.astype(np.float64)
    if y.ndim > 1:
        y = y.mean(1)
    if sr != SR:
        y = signal.resample(y, int(len(y) * SR / sr))
    return norm(y)


def slap_from(y):
    # trim to the hit, short and dry
    on = int(np.argmax(np.abs(y) > 0.25 * np.max(np.abs(y))))
    s = y[max(0, on - int(SR * 0.002)): on + int(SR * 0.09)].copy()
    s *= np.minimum(1, (len(s) - np.arange(len(s))) / (SR * 0.03))
    return norm(s)


def card(slap, dur, f0, f1, seed, swish_lvl, slap_lvl):
    w = swish(dur, f0, f1, seed, swish_lvl)
    n = len(w) + len(slap)
    x = np.zeros(n)
    x[: len(w)] += w
    at = int(len(w) * 0.82)
    x[at: at + len(slap)] += slap * slap_lvl
    x = x[: at + len(slap)]
    return norm(x, 0.9)


if __name__ == '__main__':
    src = sys.argv[1]
    for i, (tau, bf) in enumerate([(0.34, 2700), (0.38, 2450), (0.30, 3000), (0.42, 2250), (0.33, 2850), (0.40, 2550)]):
        write_mp3(f'clack{i + 1}', clack(tau, bf, 100 + i))
    s1, s2 = slap_from(load_wav(os.path.join(src, 'contact1.wav'))), slap_from(load_wav(os.path.join(src, 'contact2.wav')))
    for i in range(4):
        write_mp3(f'throw{i + 1}', card(s1 if i % 2 == 0 else s2, 0.13 + 0.02 * i, 1400 + 150 * i, 4200 - 200 * i, 200 + i, 1.0, 0.85))
        write_mp3(f'deal{i + 1}', card(s2 if i % 2 == 0 else s1, 0.085 + 0.01 * i, 1800 + 100 * i, 5000 - 250 * i, 300 + i, 0.75, 0.55))
    # place1..4: a wooden checker set down on a wooden board: dull body knock + short soft click, no ringing
    for i, (lo, mid) in enumerate([(210, 1500), (240, 1700), (190, 1350), (260, 1850)]):
        n = int(SR * 0.14); t = np.arange(n) / SR; g = np.random.default_rng(400 + i)
        tau = 0.0009
        click = np.gradient(np.where(t < tau, np.sin(np.pi * t / tau), 0.0))
        x = resonator(click, lo, 18) * 1.0 + resonator(click, lo * 2.3, 7) * 0.35 + resonator(click, mid, 3) * 0.5
        x += signal.lfilter(*signal.butter(2, 3000 / (SR / 2)), g.standard_normal(n) * np.exp(-t / 0.004)) * 0.02
        x *= np.minimum(1, (n - np.arange(n)) / (SR * 0.03))
        write_mp3(f'place{i + 1}', norm(x, 0.95))
    print('ok')
