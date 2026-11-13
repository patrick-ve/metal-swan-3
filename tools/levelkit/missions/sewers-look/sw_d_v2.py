import os
os.environ['LK_VAR'] = 'v2'
os.environ['LK_LIGHT'] = 'amb'
from sw_d import *          # noqa: F401,F403  (variant v2, ambient: the gates run on this module)


def build():
    import sw_d
    return sw_d.build('v2', 'amb', sid='v2')
