import os
from sw_d import *          # noqa: F401,F403  (variant v2, the flashlight's lit key)


def build():
    import sw_d
    return sw_d.build('v2', 'lit', sid='v2l')
