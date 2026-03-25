FROM docker.io/cloudflare/sandbox:0.7.20

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/workspace
ENV XDG_CONFIG_HOME=/workspace/.config
ENV SHELL=/usr/bin/fish

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    fish \
    gh \
    git \
    less \
    neovim \
    nodejs \
    procps \
    python3 \
    ripgrep \
    tmux \
    unzip \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

RUN mkdir -p /workspace/.config/gh

WORKDIR /workspace
