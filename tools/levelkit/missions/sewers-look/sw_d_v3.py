import os
os.environ['LK_VAR'] = 'v3'
os.environ['LK_LIGHT'] = 'amb'
from sw_d import *          # noqa: F401,F403  (variant v3, ambient: the gates run on this module)


def build():
    import sw_d
    return sw_d.build('v3', 'amb', sid='v3')
