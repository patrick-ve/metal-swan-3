# VINCENT idle: the scale reference for every cast sample (the approved squad hero, unchanged).
import castkit as K

INFO = dict(name='VINCENT', mission=['all'], role='hero', kind='HUMANOID', face=1,
            pose='idle, pistol ready', note='The approved 40 px hero; every sample stands next to him for scale.')


def frame():
    return K.humanoid(K.A.UPPER['idle'][0][0], K.A.LOWER['stand'][0][0])
