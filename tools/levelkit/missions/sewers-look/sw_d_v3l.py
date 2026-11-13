import os
from sw_d import *          # noqa: F401,F403  (variant v3, the flashlight's lit key)


def build():
    import sw_d
    return sw_d.build('v3', 'lit', sid='v3l')
