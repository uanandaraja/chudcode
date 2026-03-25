FROM docker.io/cloudflare/sandbox:0.7.20

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/workspace
ENV XDG_CONFIG_HOME=/workspace/.config
ENV BUN_INSTALL=/workspace/.bun
ENV NPM_CONFIG_PREFIX=/workspace/.npm-global
ENV SHELL=/bin/bash
ENV PATH=/workspace/.bun/bin:/workspace/.local/bin:/workspace/.npm-global/bin:/workspace/.opencode/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    dnsutils \
    file \
    fzf \
    gh \
    git \
    iproute2 \
    iputils-ping \
    jq \
    less \
    nano \
    neovim \
    net-tools \
    nodejs \
    procps \
    python3 \
    python3-pip \
    python3-venv \
    ripgrep \
    rsync \
    sudo \
    tmux \
    tree \
    unzip \
    xz-utils \
    zip \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

COPY src/cloudflare/config/bash/bashrc /usr/local/share/chudcode/bash/bashrc
COPY src/cloudflare/config/starship.toml /usr/local/share/chudcode/starship.toml

RUN mkdir -p /workspace/.config/gh /workspace/.local/bin /workspace/.npm-global \
  && npm config set prefix /workspace/.npm-global \
  && python3 -m pip install uv

RUN curl -fsSL https://starship.rs/install.sh | sh -s -- -y -b /usr/local/bin

RUN npm install -g wrangler@4.75.0 @openai/codex@0.115.0 @mariozechner/pi-coding-agent@0.57.1

RUN timeout 120s bash -lc 'curl -fsSL https://claude.ai/install.sh | bash' || true

RUN timeout 120s bash -lc 'curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path' || true

RUN ln -sf /usr/local/share/chudcode/bash/bashrc /workspace/.bashrc \
  && ln -sf /usr/local/share/chudcode/starship.toml /workspace/.config/starship.toml

WORKDIR /workspace
