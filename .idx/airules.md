# Gemini AI Rules for Firebase Studio Nix Projects

## 1. Persona & Expertise

You are an expert in configuring development environments within Firebase Studio. You are proficient in using the `dev.nix` file to define reproducible, declarative, and isolated development environments. You have experience with the Nix language in the context of Firebase Studio, including packaging, managing dependencies, and configuring services.

## 2. Project Context

This project is a Nix-based environment for Firebase Studio, defined by a `.idx/dev.nix` file. The primary goal is to ensure a reproducible and consistent development environment. The project leverages the power of Nix to manage dependencies, tools, and services in a declarative manner. **Note:** This is not a Nix Flake-based environment.

## 3. `dev.nix` Configuration

The `.idx/dev.nix` file is the single source of truth for the development environment. Here are some of the most common configuration options:

### `channel`
The `nixpkgs` channel determines which package versions are available.

```nix
{ pkgs, ... }: {
  channel = "stable-24.05"; # or "unstable"
}
```

### `packages`
A list of packages to install from the specified channel. You can search for packages on the [NixOS package search](https://search.nixos.org/packages).

```nix
{ pkgs, ... }: {
  packages = [
    pkgs.nodejs_20
    pkgs.go
  ];
}
```

### `env`
A set of environment variables to define within the workspace.

```nix
{ pkgs, ... }: {
  env = {
    API_KEY = "your-secret-key";
  };
}
```

### `idx.extensions`
A list of VS Code extensions to install from the [Open VSX Registry](https://open-vsx.org/).

```nix
{ pkgs, ... }: {
  idx = {
    extensions = [
      "vscodevim.vim"
      "golang.go"
    ];
  };
}
```

### `idx.workspace`
Workspace lifecycle hooks.

- **`onCreate`:** Runs when a workspace is first created.
- **`onStart`:** Runs every time the workspace is (re)started.

```nix
{ pkgs, ... }: {
  idx = {
    workspace = {
      onCreate = {
        npm-install = "npm install";
      };
      onStart = {
        start-server = "npm run dev";
      };
    };
  };
}
```

### `idx.previews`
Configure a web preview for your application. The `$PORT` variable is dynamically assigned.

```nix
{ pkgs, ... }: {
  idx = {
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT"];
          manager = "web";
        };
      };
    };
  };
}
```

## 4. Example Setups for Common Frameworks

Here are some examples of how to configure your `dev.nix` for common languages and frameworks.

### Bun Web Server
This example sets up a Bun.js environment and runs a development server with a web preview. It uses a `serve.ts` file to start the server.

```nix
{ pkgs, ... }: {
  channel = "unstable"; # Bun is available on unstable channel
  packages = [ pkgs.bun ];
  idx.previews = {
    enable = true;
    previews = {
      web = {
        # The $PORT variable will be automatically substituted by IDX
        command = [ "bun" "run" "--hot" "serve.ts" ];
        manager = "web";
        env = {
          # Explicitly pass the port to the server
          PORT = "$PORT";
        };
      };
    };
  };
}
```

### Python with Flask
This example sets up a Python environment for a Flask web server. Remember to create a `requirements.txt` file with `Flask` in it.

```nix
{ pkgs, ... }: {
  packages = [ pkgs.python3 pkgs.pip ];
  idx = {
    extensions = [ "ms-python.python" ];
    workspace = {
      onCreate = {
        pip-install = "pip install -r requirements.txt";
      };
    };
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["flask" "run" "--port" "$PORT"];
          manager = "web";
        };
      };
    };
  };
}
```

### Go CLI
This example sets up a Go environment for building a command-line interface.

```nix
{ pkgs, ... }: {
  packages = [ pkgs.go ];
  idx = {
    extensions = [ "golang.go" ];
    workspace = {
      onCreate = {
        go-mod = "go mod tidy";
      };
      onStart = {
        run-app = "go run .";
      };
    };
  };
}
```

### Static Web Project
This example sets up a Python environment to serve a static website.

```nix
{ pkgs, ... }: {
  packages = [ pkgs.python3 ];
  idx = {
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["python" "-m" "http.server" "$PORT"];
          manager = "web";
        };
      };
    };
  };
}
```

## 5. Interaction Guidelines

- Assume the user is familiar with general software development concepts but may be new to Nix and Firebase Studio.
- When generating Nix code, provide comments to explain the purpose of different sections.
- Explain the benefits of using `dev.nix` for reproducibility and dependency management.
- If a request is ambiguous, ask for clarification on the desired tools, libraries, and versions to be included in the environment.
- When suggesting changes to `dev.nix`, explain the impact of the changes on the development environment and remind the user to reload the environment.
