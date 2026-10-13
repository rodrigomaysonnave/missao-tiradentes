# Missão Tiradentes

Preparatório independente hospedado em https://rodrigomaysonnave.github.io/missao-tiradentes/.

Frontend estático. Cadastro, aprovação, questões, correção e histórico são protegidos pelo Supabase. Este repositório contém apenas os arquivos públicos; não publique os PDFs originais, gabaritos, dados de alunos ou credenciais privadas.

## Aprendizagem

O diagnóstico concluído aparece como tal nos simulados. Os treinos de matemática geram novas questões no servidor, com 27 modelos em 13 habilidades; números, resultados e alternativas variam. Cada resultado fica reservado por aluno e habilidade, incluindo exercícios antigos, para impedir repetição. As dificuldades recentes orientam o padrão da revisão. Português tem um banco privado de variações de exercícios para as 12 habilidades. Diagnóstico e prática solicitam novas questões ao servidor; o plano consulta a disponibilidade antes de recomendar uma missão. Conteúdos sem novos desafios continuam disponíveis como revisão e não são sugeridos como próxima prática. Cada prova histórica aceita uma tentativa, com consulta posterior à correção. A estratégia combina dificuldades, revisão de acertos e habilidades ainda não avaliadas, com sessões nos dias escolhidos pelo aluno. As metas são versionadas; alterações começam na próxima semana. Tempo ativo registrado e frequência são indicadores separados.

## Relatórios

O acompanhamento corrente é visível no curso, sem download. Somente relatórios semanais com status `sent` e `sent_at` preenchido são acessíveis e podem ser baixados. A autorização do responsável deve estar vinculada ao e-mail confirmado da conta. O agendamento no backend inicia o envio semanal às segundas-feiras, às 08:00 de São Paulo, com retomada diária de falhas confirmadas. O envio efetivo depende de SMTP_USER e SMTP_PASSWORD configurados como segredos da função weekly-reports. A senha de aplicativo do Gmail é inserida diretamente no Supabase, sem passar pelo site ou pelo repositório. Não marque relatórios como enviados sem confirmação do serviço.

Configuração pública em `config.js`: URL e chave publicável. Nunca usar chaves secretas ou de serviço no frontend.
