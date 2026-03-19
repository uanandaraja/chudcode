# devbox web

copy env:

```bash
cp .env.example .env
```

required:

```bash
E2B_API_KEY=
```

install:

```bash
bun install
bun run gen
```

web app:

```bash
bun run dev
bun run dev:cf
bun run build
bun run preview
```

deploy:

```bash
wrangler deploy
```

template admin:

```bash
bun run build:template:dev
bun run sandbox:create
bun run sandbox:list
bun run sandbox:ssh <sandbox-id>
```
