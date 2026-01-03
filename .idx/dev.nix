{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [ pkgs.python3 ];
  idx = {
    extensions = [ "google.gemini-cli-vscode-ide-companion" ];
    previews = {
      enable = true;
      previews = {
        web = {
          # Запускаем простой HTTP-сервер для обслуживания статичных файлов
          command = ["python" "-m" "http.server" "$PORT"];
          manager = "web";
        };
      };
    };
    workspace = {
      onCreate = {
        default.openFiles = [ ".idx/dev.nix" "index.html" "main.js" ];
      };
    };
  };
}
