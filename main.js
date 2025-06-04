console.log("Processo principal")

const { app, BrowserWindow, nativeTheme, Menu, ipcMain, dialog, shell } = require('electron')

// Esta linha está relacionada ao preload.js
const path = require('node:path')

const mongoose = require('mongoose')

// Importação dos métodos conectar e desconectar (módulo de conexão)
const { conectar, desconectar } = require('./database.js')

// Importação do Schema Clientes da camada model
const clientModel = require('./src/models/Clientes.js')

// Importação do Schema OS da camada model
const osModel = require('./src/models/OS.js')


// Importação do pacote jspdf (npm i jspdf)
const { jspdf, default: jsPDF } = require('jspdf')

// Importação da biblioteca fs (nativa do JavaScript) para manipulação de arquivos (no caso arquivos pdf)
const fs = require('fs')

// importação do pacote electron-prompt (dialog de input) - npm i electron-prompt
const prompt = require('electron-prompt')

// Janela principal
let win
const createWindow = () => {
    // a linha abaixo define o tema (claro ou escuro)
    nativeTheme.themeSource = 'light' //(dark ou light)
    win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: './src/public/img/LuxCar.png',
        //autoHideMenuBar: true,
        //minimizable: false,
        resizable: false,
        //ativação do preload.js
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // menu personalizado
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))

    win.loadFile('./src/views/index.html')
}

// Janela sobre
function aboutWindow() {
    nativeTheme.themeSource = 'light'
    // a linha abaixo obtém a janela principal
    const main = BrowserWindow.getFocusedWindow()
    let about
    // Estabelecer uma relação hierárquica entre janelas
    if (main) {
        // Criar a janela sobre
        about = new BrowserWindow({
            width: 360,
            height: 250,
            icon: './src/public/img/LuxCar.png',
            autoHideMenuBar: true,
            resizable: false,
            minimizable: false,
            parent: main,
            modal: true
        })
    }
    //carregar o documento html na janela
    about.loadFile('./src/views/sobre.html')
}

// Janela cliente
let client
function clientWindow() {
    nativeTheme.themeSource = 'light'
    const main = BrowserWindow.getFocusedWindow()
    if (main) {
        client = new BrowserWindow({
            width: 1010,
            height: 680,
            icon: './src/public/img/icone.png',
            //autoHideMenuBar: true,
            //resizable: false,
            parent: main,
            modal: true,
            //ativação do preload.js
            webPreferences: {
                preload: path.join(__dirname, 'preload.js')
            }
        })
    }
    client.loadFile('./src/views/cliente.html')
    client.center() //iniciar no centro da tela   
}

// Janela OS
let os
function osWindow() {
    nativeTheme.themeSource = 'light'
    const main = BrowserWindow.getFocusedWindow()
    if (main) {
        os = new BrowserWindow({
            width: 1010,
            height: 720,
            icon: './src/public/img/icone.png',
            // autoHideMenuBar: true,
            resizable: false,
            parent: main,
            modal: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js')
            }
        })
    }
    os.loadFile('./src/views/os.html')
    os.center()
}

// Iniciar a aplicação
app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// reduzir logs não críticos
app.commandLine.appendSwitch('log-level', '3')

// iniciar a conexão com o banco de dados (pedido direto do preload.js)
ipcMain.on('db-connect', async (event) => {
    let conectado = await conectar()
    // se conectado for igual a true
    if (conectado) {
        // enviar uma mensagem para o renderizador trocar o ícone, criar um delay de 0.5s para sincronizar a nuvem
        setTimeout(() => {
            event.reply('db-status', "conectado")
        }, 500) //500ms        
    }
})

// IMPORTANTE ! Desconectar do banco de dados quando a aplicação for encerrada.
app.on('before-quit', () => {
    desconectar()
})

// template do menu
const template = [
    {
        label: 'Cadastro',
        submenu: [
            {
                label: 'Clientes',
                click: () => clientWindow()
            },
            {
                label: 'OS',
                click: () => osWindow()
            },
            {
                type: 'separator'
            },
            {
                label: 'Sair',
                click: () => app.quit(),
                accelerator: 'Alt+F4'
            }
        ]
    },
    {
        label: 'Relatórios',
        submenu: [
            {
                label: 'Clientes',
                click: () => relatorioClientes()
            },
            {
                label: 'OS abertas',
                click: () => relatorioOsAberta()
            },
            {
                label: 'OS Finalizadas',
                click: () => relatorioOsConcluida()
            }
        ]
    },
    {
        label: 'Ferramentas',
        submenu: [
            {
                label: 'Aplicar zoom',
                role: 'zoomIn'
            },
            {
                label: 'Reduzir',
                role: 'zoomOut'
            },
            {
                label: 'Restaurar o zoom padrão',
                role: 'resetZoom'
            },
            {
                type: 'separator'
            },
            {
                label: 'Recarregar',
                role: 'reload'
            },
            {
                label: 'Ferramentas do desenvolvedor',
                role: 'toggleDevTools'
            }
        ]
    },
    {
        label: 'Ajuda',
        submenu: [
            {
                label: 'Sobre',
                click: () => aboutWindow()
            }
        ]
    }
]

// recebimento dos pedidos do renderizador para abertura de janelas (botões) autorizado no preload.js
ipcMain.on('client-window', () => {
    clientWindow()
})

ipcMain.on('os-window', () => {
    osWindow()
})

// ============================================================
// == Clientes - CRUD Create
// recebimento do objeto que contem os dados do cliente
ipcMain.on('new-client', async (event, client) => {
    // Importante! Teste de recebimento dos dados do cliente
    console.log(client)
    // Cadastrar a estrutura de dados no banco de dados MongoDB
    try {
        // criar uma nova de estrutura de dados usando a classe modelo. Atenção! Os atributos precisam ser idênticos ao modelo de dados Clientes.js e os valores são definidos pelo conteúdo do objeto cliente
        const newClient = new clientModel({
            nomeCliente: client.nameCli,
            cpfCliente: client.cpfCli,
            emailCliente: client.emailCli,
            foneCliente: client.phoneCli,
            cepCliente: client.cepCli,
            logradouroCliente: client.addressCli,
            numeroCliente: client.numberCli,
            complementoCliente: client.complementCli,
            bairroCliente: client.neighborhoodCli,
            cidadeCliente: client.cityCli,
            ufCliente: client.ufCli
        })
        // salvar os dados do cliente no banco de dados
        await newClient.save()
        // Mensagem de confirmação
        dialog.showMessageBox({
            //customização
            type: 'info',
            title: "Aviso",
            message: "Cliente adicionado com sucesso",
            buttons: ['OK']
        }).then((result) => {
            //ação ao pressionar o botão (result = 0)
            if (result.response === 0) {
                //enviar um pedido para o renderizador limpar os campos e resetar as configurações pré definidas (rótulo 'reset-form' do preload.js
                event.reply('reset-form')
            }
        })
    } catch (error) {
        // se o código de erro for 11000 (cpf duplicado) enviar uma mensagem ao usuário
        if (error.code === 11000) {
            dialog.showMessageBox({
                type: 'error',
                title: "Atenção!",
                message: "CPF já está cadastrado\nVerifique se digitou corretamente",
                buttons: ['OK']
            }).then((result) => {
                if (result.response === 0) {
                    // limpar a caixa de input do cpf, focar esta caixa e deixar a borda em vermelho
                }
            })
        }
        console.log(error)
    }
})
// == Fim - Clientes - CRUD Create

// OS - CRUD create
ipcMain.on('new-os', async (event, os) => {
    console.log(os)
    try {
        const novaOS = new osModel({
            nomeCliente: os.nomeCliente,
            foneCliente: os.foneCliente,
            cpfCliente: os.cpfCliente,
            statusOS: os.statusOS,
            modeloCarro: os.modeloCarro,
            marcaCarro: os.marcaCarro,
            placaCarro: os.placaCarro,
            servico: os.servico,
            funcionario: os.funcionario,
            pecas: os.pecas,
            observacoes: os.observacoes,
            orcamento: os.orcamento

        })
        await novaOS.save()


        const osId = novaOS._id
        console.log("ID da nova OS:", osId)

        // Mensagem de confirmação
        dialog.showMessageBox({
            //customização
            type: 'info',
            title: "Aviso",
            message: "OS gerada com sucesso.\nDeseja imprimir esta OS?",
            buttons: ['Sim', 'Não'] // [0, 1]
        }).then((result) => {
            //ação ao pressionar o botão (result = 0)
            if (result.response === 0) {
                // executar a função printOS passando o id da OS como parâmetro
                printOS(osId)
                //enviar um pedido para o renderizador limpar os campos e resetar as configurações pré definidas (rótulo 'reset-form' do preload.js
                event.reply('reset-form-os')
            } else {
                //enviar um pedido para o renderizador limpar os campos e resetar as configurações pré definidas (rótulo 'reset-form' do preload.js
                event.reply('reset-form-os')
            }
        })
    } catch (error) {
        console.log(error)
    }
})

//  fim OS - CRUD create
// ============================================================


// ============================================================
// == Relatório de clientes ===================================

async function relatorioClientes() {
    try {
        // Passo 1: Consultar o banco de dados e obter a listagem de clientes cadastrados por ordem alfabética
        const clientes = await clientModel.find().sort({ nomeCliente: 1 })
        // teste de recebimento da listagem de clientes
        //console.log(clientes)
        // Passo 2:Formatação do documento pdf
        // p - portrait | l - landscape | mm e a4 (folha A4 (210x297mm))
        const doc = new jsPDF('p', 'mm', 'a4')
        // Inserir imagem no documento pdf
        // imagePath (caminho da imagem que será inserida no pdf)
        // imageBase64 (uso da biblioteca fs par ler o arquivo no formato png)
        const imagePath = path.join(__dirname, 'src', 'public', 'img', 'LuxCar.png')
        const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' })
        doc.addImage(imageBase64, 'PNG', 10, 1) //(5mm, 8mm x,y)
        // definir o tamanho da fonte (tamanho equivalente ao word)
        doc.setFontSize(18)
        // escrever um texto (título)
        doc.text("Relatório de clientes", 14, 50)//x, y (mm)
        // inserir a data atual no relatório
        const dataAtual = new Date().toLocaleDateString('pt-BR')
        doc.setFontSize(12)
        doc.text(`Data: ${dataAtual}`, 165, 10)
        // variável de apoio na formatação
        let y = 60
        doc.text("Nome", 14, y)
        doc.text("Telefone", 80, y)
        doc.text("E-mail", 130, y)
        y += 5
        // desenhar uma linha
        doc.setLineWidth(0.5) // expessura da linha
        doc.line(10, y, 200, y) // 10 (inicio) ---- 200 (fim)

        // renderizar os clientes cadastrados no banco
        y += 10 // espaçamento da linha
        // percorrer o vetor clientes(obtido do banco) usando o laço forEach (equivale ao laço for)
        clientes.forEach((c) => {
            // adicionar outra página se a folha inteira for preenchida (estratégia é saber o tamnaho da folha)
            // folha A4 y = 297mm
            if (y > 280) {
                doc.addPage()
                y = 20 // resetar a variável y
                // redesenhar o cabeçalho
                doc.text("Nome", 14, y)
                doc.text("Telefone", 80, y)
                doc.text("E-mail", 130, y)
                y += 5
                doc.setLineWidth(0.5)
                doc.line(10, y, 200, y)
                y += 10
            }
            doc.text(c.nomeCliente, 14, y),
                doc.text(c.foneCliente, 80, y),
                doc.text(c.emailCliente || "N/A", 130, y)
            y += 10 //quebra de linha
        })

        // Adicionar numeração automática de páginas
        const paginas = doc.internal.getNumberOfPages()
        for (let i = 1; i <= paginas; i++) {
            doc.setPage(i)
            doc.setFontSize(10)
            doc.text(`Página ${i} de ${paginas}`, 105, 290, { align: 'center' })
        }

        // Definir o caminho do arquivo temporário e nome do arquivo
        const tempDir = app.getPath('temp')
        const filePath = path.join(tempDir, 'clientes.pdf')
        // salvar temporariamente o arquivo
        doc.save(filePath)
        // abrir o arquivo no aplicativo padrão de leitura de pdf do computador do usuário
        shell.openPath(filePath)
    } catch (error) {
        console.log(error)
    }
}

// == Fim - relatório de clientes =============================
// ============================================================

// == Relatório de OS aberta  ===================================

async function relatorioOsAberta() {
    try {
        // Passo 1: Consultar o banco de dados e obter a listagem de clientes cadastrados por ordem alfabética
        const clientes = await osModel.find({statusOS:'Aberta'}).sort({ nomeCliente: 1 })
        // teste de recebimento da listagem de clientes
        //console.log(clientes)
        // Passo 2:Formatação do documento pdf
        // p - portrait | l - landscape | mm e a4 (folha A4 (210x297mm))
        const doc = new jsPDF('p', 'mm', 'a4')
        // Inserir imagem no documento pdf
        // imagePath (caminho da imagem que será inserida no pdf)
        // imageBase64 (uso da biblioteca fs par ler o arquivo no formato png)
        const imagePath = path.join(__dirname, 'src', 'public', 'img', 'LuxCar.png')
        const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' })
        doc.addImage(imageBase64, 'PNG', 10, 1) //(5mm, 8mm x,y)
        // definir o tamanho da fonte (tamanho equivalente ao word)
        doc.setFontSize(18)
        // escrever um texto (título)
        doc.text("Relatório de OS Aberta", 14, 50)//x, y (mm)
        // inserir a data atual no relatório
        const dataAtual = new Date().toLocaleDateString('pt-BR')
        doc.setFontSize(12)
        doc.text(`Data: ${dataAtual}`, 165, 10)
        // variável de apoio na formatação
        let y = 60
        doc.text("Nome", 14, y)
        doc.text("Status OS", 80, y)
        doc.text("CPF", 130, y)
        y += 5
        // desenhar uma linha
        doc.setLineWidth(0.5) // expessura da linha
        doc.line(10, y, 200, y) // 10 (inicio) ---- 200 (fim)

        // renderizar os clientes cadastrados no banco
        y += 10 // espaçamento da linha
        // percorrer o vetor clientes(obtido do banco) usando o laço forEach (equivale ao laço for)
        clientes.forEach((c) => {
            // adicionar outra página se a folha inteira for preenchida (estratégia é saber o tamnaho da folha)
            // folha A4 y = 297mm
            if (y > 280) {
                doc.addPage()
                y = 20 // resetar a variável y
                // redesenhar o cabeçalho
                doc.text("Nome", 14, y)
                doc.text("Status OS", 80, y)
                doc.text("CPF", 130, y)
                y += 5
                doc.setLineWidth(0.5)
                doc.line(10, y, 200, y)
                y += 10
            }
            doc.text(c.nomeCliente, 14, y),
                doc.text(c.statusOS, 80, y),
                doc.text(c.cpfCliente || "N/A", 130, y)
            y += 10 //quebra de linha
        })

        // Adicionar numeração automática de páginas
        const paginas = doc.internal.getNumberOfPages()
        for (let i = 1; i <= paginas; i++) {
            doc.setPage(i)
            doc.setFontSize(10)
            doc.text(`Página ${i} de ${paginas}`, 105, 290, { align: 'center' })
        }

        // Definir o caminho do arquivo temporário e nome do arquivo
        const tempDir = app.getPath('temp')
        const filePath = path.join(tempDir, 'OSAberta.pdf')
        // salvar temporariamente o arquivo
        doc.save(filePath)
        // abrir o arquivo no aplicativo padrão de leitura de pdf do computador do usuário
        shell.openPath(filePath)
    } catch (error) {
        console.log(error)
    }
}

// == Fim - relatório de OS aberta =============================
// ============================================================

// == Relatório de OS aberta  ===================================

async function relatorioOsConcluida() {
    try {
        // Passo 1: Consultar o banco de dados e obter a listagem de clientes cadastrados por ordem alfabética
        const clientes = await osModel.find({statusOS:'Finalizada'}).sort({ nomeCliente: 1 })
        // teste de recebimento da listagem de clientes
        //console.log(clientes)
        // Passo 2:Formatação do documento pdf
        // p - portrait | l - landscape | mm e a4 (folha A4 (210x297mm))
        const doc = new jsPDF('p', 'mm', 'a4')
        // Inserir imagem no documento pdf
        // imagePath (caminho da imagem que será inserida no pdf)
        // imageBase64 (uso da biblioteca fs par ler o arquivo no formato png)
        const imagePath = path.join(__dirname, 'src', 'public', 'img', 'LuxCar.png')
        const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' })
        doc.addImage(imageBase64, 'PNG', 10, 1) //(5mm, 8mm x,y)
        // definir o tamanho da fonte (tamanho equivalente ao word)
        doc.setFontSize(18)
        // escrever um texto (título)
        doc.text("Relatório de OS Finalizada", 14, 50)//x, y (mm)
        // inserir a data atual no relatório
        const dataAtual = new Date().toLocaleDateString('pt-BR')
        doc.setFontSize(12)
        doc.text(`Data: ${dataAtual}`, 165, 10)
        // variável de apoio na formatação
        let y = 60
        doc.text("Nome", 14, y)
        doc.text("Status OS", 80, y)
        doc.text("CPF", 130, y)
        y += 5
        // desenhar uma linha
        doc.setLineWidth(0.5) // expessura da linha
        doc.line(10, y, 200, y) // 10 (inicio) ---- 200 (fim)

        // renderizar os clientes cadastrados no banco
        y += 10 // espaçamento da linha
        // percorrer o vetor clientes(obtido do banco) usando o laço forEach (equivale ao laço for)
        clientes.forEach((c) => {
            // adicionar outra página se a folha inteira for preenchida (estratégia é saber o tamnaho da folha)
            // folha A4 y = 297mm
            if (y > 280) {
                doc.addPage()
                y = 20 // resetar a variável y
                // redesenhar o cabeçalho
                doc.text("Nome", 14, y)
                doc.text("Status OS", 80, y)
                doc.text("CPF", 130, y)
                y += 5
                doc.setLineWidth(0.5)
                doc.line(10, y, 200, y)
                y += 10
            }
            doc.text(c.nomeCliente, 14, y),
                doc.text(c.statusOS, 80, y),
                doc.text(c.cpfCliente || "N/A", 130, y)
            y += 10 //quebra de linha
        })

        // Adicionar numeração automática de páginas
        const paginas = doc.internal.getNumberOfPages()
        for (let i = 1; i <= paginas; i++) {
            doc.setPage(i)
            doc.setFontSize(10)
            doc.text(`Página ${i} de ${paginas}`, 105, 290, { align: 'center' })
        }

        // Definir o caminho do arquivo temporário e nome do arquivo
        const tempDir = app.getPath('temp')
        const filePath = path.join(tempDir, 'OSFinalizada.pdf')
        // salvar temporariamente o arquivo
        doc.save(filePath)
        // abrir o arquivo no aplicativo padrão de leitura de pdf do computador do usuário
        shell.openPath(filePath)
    } catch (error) {
        console.log(error)
    }
}

// == Fim - relatório de OS aberta =============================
// =========================================================




////////////////////// gerar os///////////////




// GERAR OS 
// Validação de busca (preenchimento obrigatório Id Cliente-OS)
ipcMain.on('validate-client', (event) => {
    dialog.showMessageBox({
        type: 'warning',
        title: "Aviso!",
        message: "É obrigatório vincular o cliente na Ordem de Serviço",
        buttons: ['OK']
    }).then((result) => {
        //ação ao pressionar o botão (result = 0)
        if (result.response === 0) {
            event.reply('set-search')
        }
    })
})



// == Fim - CRUD Create - Gerar OS ===========================
// ============================================================





// ============================================================
// == CRUD Read ===============================================

// Validação de busca (preenchimento obrigatório)
ipcMain.on('validate-search', () => {
    dialog.showMessageBox({
        type: 'warning',
        title: "Atenção!",
        message: "Preencha o campo de busca",
        buttons: ['OK']
    })
})

ipcMain.on('search-name', async (event, name) => {
    //console.log("teste IPC search-name")
    //console.log(name) // teste do passo 2 (importante!)
    // Passos 3 e 4 busca dos dados do cliente no banco
    //find({nomeCliente: name}) - busca pelo nome
    //RegExp(name, 'i') - i (insensitive / Ignorar maiúsculo ou minúsculo)
    try {
        const dataClient = await clientModel.find({
           $or:[
            {nomeCliente: new RegExp(name, 'i')},
            {cpfCliente: new RegExp(name, 'i')}


           ]
        })
        console.log(dataClient) // teste passos 3 e 4 (importante!)

        // melhoria da experiência do usuário (se o cliente não estiver cadastrado, alertar o usuário e questionar se ele quer cadastrar este novo cliente. Se não quiser cadastrar, limpar os campos, se quiser cadastrar recortar o nome do cliente do campo de busca e colar no campo nome)

        // se o vetor estiver vazio [] (cliente não cadastrado)
        if (dataClient.length === 0) {
            dialog.showMessageBox({
                type: 'warning',
                title: "Aviso",
                message: "Cliente não cadastrado.\nDeseja cadastrar este cliente?",
                defaultId: 0, //botão 0
                buttons: ['Sim', 'Não'] // [0, 1]
            }).then((result) => {
                if (result.response === 0) {
                    // enviar ao renderizador um pedido para setar os campos (recortar do campo de busca e colar no campo nome)
                    event.reply('set-client')
                } else {
                    // limpar o formulário
                    event.reply('reset-form')
                }
            })
        }

        // Passo 5:
        // enviando os dados do cliente ao rendererCliente
        // OBS: IPC só trabalha com string, então é necessário converter o JSON para string JSON.stringify(dataClient)
        event.reply('render-client', JSON.stringify(dataClient))

    } catch (error) {
        console.log(error)
    }
})

// == Fim - CRUD Read =========================================
// ============================================================


// ============================================================
// == CRUD Delete =============================================

ipcMain.on('delete-client', async (event, id) => {
    console.log(id) // teste do passo 2 (recebimento do id)
    try {
        //importante - confirmar a exclusão
        //client é o nome da variável que representa a janela
        const { response } = await dialog.showMessageBox(client, {
            type: 'warning',
            title: "Atenção!",
            message: "Deseja excluir este cliente?\nEsta ação não poderá ser desfeita.",
            buttons: ['Cancelar','Excluir'] //[0, 1]
        })
        if (response === 1) {
            console.log("teste do if de excluir")
            //Passo 3 - Excluir o registro do cliente
            const delClient = await clientModel.findByIdAndDelete(id)
            event.reply('reset-form')
        }
    } catch (error) {
        console.log(error)
    }
})

// == Fim - CRUD Delete =======================================

// == CRUD Update =============================================
ipcMain.on('update-client', async (event, client) => {
    console.log(client) //teste importante (recebimento dos dados do cliente)
    try {
        // criar uma nova de estrutura de dados usando a classe modelo. Atenção! Os atributos precisam ser idênticos ao modelo de dados Clientes.js e os valores são definidos pelo conteúdo do objeto cliente
        const updateClient = await clientModel.findByIdAndUpdate(
            client.idCli,
            {
                nomeCliente: client.nameCli,
                cpfCliente: client.cpfCli,
                emailCliente: client.emailCli,
                foneCliente: client.phoneCli,
                cepCliente: client.cepCli,
                logradouroCliente: client.addressCli,
                numeroCliente: client.numberCli,
                complementoCliente: client.complementCli,
                bairroCliente: client.neighborhoodCli,
                cidadeCliente: client.cityCli,
                ufCliente: client.ufCli
            },
            {
                new: true
            }
        )
        // Mensagem de confirmação
        dialog.showMessageBox({
            //customização
            type: 'info',
            title: "Aviso",
            message: "Dados do cliente alterados com sucesso",
            buttons: ['OK']
        }).then((result) => {
            //ação ao pressionar o botão (result = 0)
            if (result.response === 0) {
                //enviar um pedido para o renderizador limpar os campos e resetar as configurações pré definidas (rótulo 'reset-form' do preload.js
                event.reply('reset-form')
            }
        })

    } catch (error) {
        console.log(error)
    }
})
// == Fim - CRUD Update =======================================
// ============================================================

//************************************************************/
//*******************  Ordem de Serviço  *********************/
//************************************************************/


// ============================================================
// == Buscar OS ===============================================
ipcMain.on('search-os', async (event) => {
    prompt({
        title: 'Buscar OS',
        label: 'Digite o número da OS:',
        inputAttrs: {
            type: 'text'
        },
        type: 'input',
        width: 400,
        height: 200
    }).then(async (result) => {
        // buscar OS pelo id (verificar formato usando o mongoose - importar no início do main)
        if (result !== null) {
            // Verificar se o ID é válido (uso do mongoose - não esquecer de importar)
            if (mongoose.Types.ObjectId.isValid(result)) {
                try {
                    const dataOS = await osModel.findById(result)
                    if (dataOS && dataOS !== null) {
                        console.log(dataOS) // teste importante
                        // enviando os dados da OS ao rendererOS
                        // OBS: IPC só trabalha com string, então é necessário converter o JSON para string JSON.stringify(dataOS)
                        event.reply('render-os', JSON.stringify(dataOS))
                    } else {
                        dialog.showMessageBox({
                            type: 'warning',
                            title: "Aviso!",
                            message: "OS não encontrada",
                            buttons: ['OK']
                        })
                    }
                } catch (error) {
                    console.log(error)
                }
            } else {
                dialog.showMessageBox({
                    type: 'error',
                    title: "Atenção!",
                    message: "Código da OS inválido.\nVerifique e tente novamente.",
                    buttons: ['OK']
                })
            }
        }
    })
})


// == Fim - Buscar OS =========================================
// ============================================================


// ============================================================
// == Buscar cliente para vincular na OS(busca estilo Google) = 

ipcMain.on('search-clients', async (event) => {
    try {
        // buscar no banco os clientes pelo nome em ordem alfabética
        const clients = await clientModel.find().sort({ nomeCliente: 1 })
        //console.log(clients) // teste do passo 2
        // Passo 3: Envio dos clientes para o renderizador
        // Obs: não esquecer de converter para String
        event.reply('list-clients', JSON.stringify(clients))
    } catch (error) {
        console.log(error)
    }
})

// == Fim - Busca Cliente (estilo Google) =====================
// ============================================================


// ============================================================
// == Excluir OS - CRUD Delete  ===============================

ipcMain.on('delete-os', async (event, idOS) => {
    console.log(idOS) // teste do passo 2 (recebimento do id)
    try {
        //importante - confirmar a exclusão
        //osScreen é o nome da variável que representa a janela OS
        const { response } = await dialog.showMessageBox(os, {
            type: 'warning',
            title: "Atenção!",
            message: "Deseja excluir esta ordem de serviço?\nEsta ação não poderá ser desfeita.",
            buttons: ['Cancelar', 'Excluir'] //[0, 1]
        })
        if (response === 1) {
            //console.log("teste do if de excluir")
            //Passo 3 - Excluir a OS
            const delOS = await osModel.findByIdAndDelete(idOS)
            event.reply('reset-form-os')
        }
    } catch (error) {
        console.log(error)
    }
})

// == Fim Excluir OS - CRUD Delete ============================
// ============================================================


// ============================================================
// == Editar OS - CRUD Update =================================

ipcMain.on('update-os', async (event, os) => {
    //importante! teste de recebimento dos dados da os (passo 2)
    console.log(os)
    // Alterar os dados da OS no banco de dados MongoDB
    try {
        // criar uma nova de estrutura de dados usando a classe modelo. Atenção! Os atributos precisam ser idênticos ao modelo de dados OS.js e os valores são definidos pelo conteúdo do objeto os
        const updateOS = await osModel.findByIdAndUpdate(
            os.id_OS,
            {
                idCliente: os.idCliente,
                nomeCliente: os.nomeCliente,
                foneCliente: os.foneCliente,
                cpfCliente: os.cpfCliente,
                statusOS: os.statusOS,
                modeloCarro: os.modeloCarro,
                marcaCarro: os.marcaCarro,
                placaCarro: os.placaCarro,
                servico: os.servico,
                funcionario: os.funcionario,
                pecas: os.pecas,
                observacoes: os.observacoes,
                orcamento: os.orcamento
            },
            {
                new: true
            }
        )
        // Mensagem de confirmação
        dialog.showMessageBox({
            //customização
            type: 'info',
            title: "Aviso",
            message: "Dados da OS alterados com sucesso",
            buttons: ['OK']
        }).then((result) => {
            //ação ao pressionar o botão (result = 0)
            if (result.response === 0) {
                //enviar um pedido para o renderizador limpar os campos e resetar as configurações pré definidas (rótulo 'reset-form' do preload.js
                event.reply('reset-form-os')
            }
        })
    } catch (error) {
        console.log(error)
    }
})

// == Fim Editar OS - CRUD Update =============================
// ============================================================


// ============================================================
// Impressão de OS ============================================

// impressão via botão imprimir
ipcMain.on('print-os', async (event) => {
    prompt({
        title: 'Imprimir OS',
        label: 'Digite o número da OS:',
        inputAttrs: { type: 'text' },
        type: 'input',
        width: 400,
        height: 200
    }).then(async (result) => {
        if (result !== null && mongoose.Types.ObjectId.isValid(result)) {
            try {
                const dataOS = await osModel.findById(result)
                if (!dataOS) {
                    dialog.showMessageBox({
                        type: 'warning',
                        title: "Aviso!",
                        message: "OS não encontrada",
                        buttons: ['OK']
                    })
                    return
                }

                const cliente = await clientModel.findById(dataOS.idCliente)

                const doc = new jsPDF('p', 'mm', 'a4')
                const imagePath = path.join(__dirname, 'src', 'public', 'img', 'LuxCar.png')
                const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' })
                doc.addImage(imageBase64, 'PNG', 10, 10, 40, 20)

                // Dados da empresa
                doc.setFontSize(12)
                doc.text("Auto Center LuxCar", 140, 15)
                doc.text("CNPJ: 00.000.000/0001-00", 140, 20)
                doc.text("Rua da Oficina, 100 - Centro", 140, 25)
                doc.text("São Paulo - SP", 140, 30)
                doc.text("Telefone: (11) 5555-5555", 140, 35)

                // Título
                doc.setFontSize(16)
                doc.setFont(undefined, 'bold')
                doc.text("ORDEM DE SERVIÇO", 75, 45)
                doc.line(10, 47, 200, 47)

                let y = 55
                doc.setFontSize(13)
                doc.setFont(undefined, 'normal')
                doc.text(`Nº OS: ${dataOS._id}`, 14, y)
                doc.text(`Data: ${new Date(dataOS.dataOS).toLocaleString('pt-BR')}`, 130, y)
                y += 12

                // Cliente
                doc.setFont(undefined, 'bold')
                doc.setFillColor(160, 160, 160) // cinza escuro
                doc.rect(10, y, 190, 8, 'F')
                doc.text("Dados do Cliente", 14, y + 6)
                y += 14
                doc.setFont(undefined, 'normal')
                doc.text(`Nome: ${cliente?.nomeCliente || ''}`, 14, y)
                y += 8
                doc.text(`Telefone: ${cliente?.foneCliente || ''}`, 14, y)
                y += 8
                doc.text(`Email: ${cliente?.emailCliente || 'N/A'}`, 14, y)
                y += 14

                // Veículo / Serviço
                doc.setFont(undefined, 'bold')
                doc.setFillColor(160, 160, 160)
                doc.rect(10, y, 190, 8, 'F')
                doc.text("Veículo / Serviço", 14, y + 6)
                y += 14
                doc.setFont(undefined, 'normal')
                doc.text(`Modelo: ${dataOS.modeloCarro || ''}`, 14, y)
                doc.text(`Marca: ${dataOS.marcaCarro || ''}`, 100, y)
                y += 8
                doc.text(`Placa: ${dataOS.placaCarro || ''}`, 14, y)
                doc.text(`Funcionário: ${dataOS.funcionario || ''}`, 100, y)
                y += 8
                doc.text("Serviço:", 14, y)
                y += 8
                doc.text(dataOS.servico || '-', 20, y)
                y += 14

                // Peças / Insumos
                doc.setFont(undefined, 'bold')
                doc.setFillColor(160, 160, 160)
                doc.rect(10, y, 190, 8, 'F')
                doc.text("Peças / Insumos", 14, y + 6)
                y += 14
                doc.setFont(undefined, 'normal')
                doc.text(dataOS.pecas || '-', 14, y)
                y += 14

                // Observações
                doc.setFont(undefined, 'bold')
                doc.setFillColor(160, 160, 160)
                doc.rect(10, y, 190, 8, 'F')
                doc.text("Observações", 14, y + 6)
                y += 14
                doc.setFont(undefined, 'normal')
                doc.text(dataOS.observacoes || '-', 14, y)
                y += 18

                // Valor e status
                doc.setFont(undefined, 'bold')
                doc.text(`Valor estimado: R$ ${dataOS.orcamento || '0,00'}`, 14, y)
                doc.text(`Status da OS: ${dataOS.statusOS || '-'}`, 130, y)
                y += 16

                // Termo
                doc.setFontSize(9)
                doc.setFont(undefined, 'bold')
                doc.text("Termo de Serviço e Garantia", 14, y)
                y += 6
                doc.setFont(undefined, 'normal')
                const termo = `- Diagnóstico gratuito se o serviço for aprovado.
- Garantia de 90 dias conforme o CDC.
- Peças substituídas podem ser devolvidas mediante solicitação.
- Não nos responsabilizamos por dados ou itens deixados no veículo.
- Equipamentos não retirados após 90 dias poderão ser descartados.`
                doc.text(termo, 14, y, { maxWidth: 180, lineHeightFactor: 1.4 })
                y += 40

                // Assinaturas
                doc.line(20, y, 80, y)
                doc.line(120, y, 180, y)
                doc.setFontSize(10)
                doc.text("Assinatura do Cliente", 30, y + 5)
                doc.text("Assinatura da Oficina", 135, y + 5)

                // Salvar PDF
                const tempDir = app.getPath('temp')
                const filePath = path.join(tempDir, 'os.pdf')
                doc.save(filePath)
                shell.openPath(filePath)
            } catch (error) {
                console.log(error)
            }
        } else {
            dialog.showMessageBox({
                type: 'error',
                title: "Atenção!",
                message: "Código da OS inválido.\nVerifique e tente novamente.",
                buttons: ['OK']
            })
        }
    })
})





async function printOS(osId) {
    try {
        const dataOS = await osModel.findById(osId)

        const dataClient = await clientModel.find({
            _id: dataOS.idCliente
        })
        console.log(dataClient)
        // impressão (documento PDF) com os dados da OS, do cliente e termos do serviço (uso do jspdf)

        // formatação do documento pdf
        const doc = new jsPDF('p', 'mm', 'a4')
        const imagePath = path.join(__dirname, 'src', 'public', 'img', 'logo.png')
        const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' })
        doc.addImage(imageBase64, 'PNG', 5, 8)
        doc.setFontSize(18)
        doc.text("OS:", 14, 45) //x=14, y=45
        doc.setFontSize(12)

        // Extração dos dados do cliente vinculado a OS
        dataClient.forEach((c) => {
            doc.text("Cliente:", 14, 65),
                doc.text(c.nomeCliente, 34, 65),
                doc.text(c.foneCliente, 85, 65),
                doc.text(c.emailCliente || "N/A", 130, 65)
            //...
        })

        // Extração dos dados da OS                        
        doc.text(String(dataOS.computador), 14, 85)
        doc.text(String(dataOS.problema), 80, 85)

        // Texto do termo de serviço
        doc.setFontSize(10)
        const termo = `
Termo de Serviço e Garantia

O cliente autoriza a realização dos serviços técnicos descritos nesta ordem, ciente de que:

- Diagnóstico e orçamento são gratuitos apenas se o serviço for aprovado. Caso contrário, poderá ser cobrada taxa de análise.
- Peças substituídas poderão ser retidas para descarte ou devolvidas mediante solicitação no ato do serviço.
- A garantia dos serviços prestados é de 90 dias, conforme Art. 26 do Código de Defesa do Consumidor, e cobre exclusivamente o reparo executado ou peça trocada, desde que o equipamento não tenha sido violado por terceiros.
- Não nos responsabilizamos por dados armazenados. Recomenda-se o backup prévio.
- Equipamentos não retirados em até 90 dias após a conclusão estarão sujeitos a cobrança de armazenagem ou descarte, conforme Art. 1.275 do Código Civil.
- O cliente declara estar ciente e de acordo com os termos acima.`

        // Inserir o termo no PDF
        doc.text(termo, 14, 150, { maxWidth: 180 }) // x=14, y=60, largura máxima para quebrar o texto automaticamente

        // Definir o caminho do arquivo temporário e nome do arquivo
        const tempDir = app.getPath('temp')
        const filePath = path.join(tempDir, 'os.pdf')
        // salvar temporariamente o arquivo
        doc.save(filePath)
        // abrir o arquivo no aplicativo padrão de leitura de pdf do computador do usuário
        shell.openPath(filePath)

    } catch (error) {
        console.log(error)
    }
}

// Fim - Impressão de OS ======================================
// ============================================================
