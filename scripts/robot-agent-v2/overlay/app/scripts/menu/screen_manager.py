class ScreenManager:
    def __init__(self, initial_screen):
        self.screens = [initial_screen]

    def get_current_screen(self):
        return self.screens[-1] if self.screens else None

    def push_screen(self, screen):
        self.screens.append(screen)
        screen.show()

    def pop_screen(self):
        if len(self.screens) > 1:
            self.screens.pop()
            current_screen = self.get_current_screen()
            if current_screen:
                current_screen.show()

    def update(self):
        current_screen = self.get_current_screen()
        if current_screen:
            current_screen.update()

    def handle_input(self, pressed_buttons):
        current_screen = self.get_current_screen()
        if current_screen:
            presses = {}
            for button, event in pressed_buttons.items():
                if isinstance(event, dict) and event.get("released"):
                    handler = getattr(current_screen, "handle_button_release", None)
                    if handler:
                        handler(button, event)
                else:
                    presses[button] = event
            if presses:
                current_screen.handle_input(presses)
