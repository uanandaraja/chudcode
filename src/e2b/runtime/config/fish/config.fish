set -g fish_greeting

if status is-interactive
    if command -sq starship
        starship init fish | source
    end
end
