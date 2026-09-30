CRYPTOSOUND — ONE TRACK EXPERIENCE
==================================

PUBLICAR NA HOSTGATOR

1. Envie todos os arquivos e pastas para public_html.
2. Mantenha exatamente a estrutura de pastas.
3. Aguarde o upload completo do WAV (o arquivo possui aproximadamente 684 MB).
4. Acesse o domínio. Não há instalação, banco, PHP ou backend.

ARQUIVOS PRINCIPAIS

- Música: assets/audio/track.wav
- Peaks prontos: assets/audio/track-peaks.json
- Foto principal: assets/images/enio.jpg
- Capa atual: assets/images/cover.svg
- Configuração: início de js/app.js

TROCAR A MÚSICA

1. Substitua assets/audio/track.wav.
2. Altere CONFIG.track.title e CONFIG.track.audio em js/app.js se necessário.
3. Gere novamente track-peaks.json localmente:

   python tools/generate_peaks.py assets/audio/track.wav assets/audio/track-peaks.json

O script serve apenas para desenvolvimento. A hospedagem não utiliza Python.

TROCAR A FOTO PRINCIPAL

- Substitua assets/images/enio.jpg mantendo o mesmo nome; ou
- ajuste CONFIG.profileImage no início de js/app.js.

TROCAR A CAPA

- Coloque a nova imagem dentro de assets/images/.
- Ajuste CONFIG.track.cover no início de js/app.js.

OBSERVAÇÕES

- A duração da música é detectada automaticamente.
- O áudio nunca começa sozinho: o visitante deve clicar em Play.
- O site é totalmente estático e pode ser enviado por FTP ou File Manager.
- Use HTTPS no domínio final para garantir o compartilhamento nativo em celulares.
