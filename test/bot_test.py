import pyautogui,os
from time import sleep

with open(os.path.dirname(os.path.realpath(__file__)) + '\\bot_test_commands.txt') as f: # test file must end with '!load '
    lines = f.readlines()

game_name = input("Run !join then !start and paste the game name here: ")
print("move your cursor to the discord chat window")
for n in range(5,0,-1):
    print(n)
    sleep(1)

for x, command in enumerate(lines):
    command = command.replace("\n","") + (game_name if x + 1 == len(lines) else "") #append game name to the end of the last line
    print(command)
    pyautogui.typewrite(command)
    sleep(0.1)
    pyautogui.press("enter")
    sleep(2)