    /*
        Room States
        0 -> WAITING
        1 -> READY
        2 -> IN_GAME
        3 -> CLOSED

        Game states (the finite state machine the game logic layer
        drives once START_GAME fires, per the game logic spec):
        4 -> WORD_SELECTION
        5 -> PLAYING
        6 -> ROUND_END
        7 -> GAME_OVER

        IN_GAME (2) is intentionally left alone/unused by the new game
        logic — START_GAME now transitions straight into WORD_SELECTION
        instead, since that state IS the more specific "game in
        progress" state the spec's FSM defines.
    */

export const states = {
    'WAITING':0,
    'READY':1,
    'IN_GAME':2,
    "CLOSED":3,
    "WORD_SELECTION":4,
    "PLAYING":5,
    "ROUND_END":6,
    "GAME_OVER":7

}

