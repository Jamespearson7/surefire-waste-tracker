/**
 * Minimal Gmail SMTP-over-TLS sender.
 * Uses only Node.js built-ins (node:tls) — no npm packages, no Turbopack issues.
 */
import * as tls from 'node:tls'

function readResponse(socket: tls.TLSSocket): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = ''

    function onData(chunk: Buffer) {
      buffer += chunk.toString()
      // SMTP multi-line responses end when we see "NNN " (space = final line, dash = continuation)
      const lines = buffer.split('\r\n')
      for (const line of lines) {
        if (line.length >= 4 && line[3] === ' ') {
          cleanup()
          resolve({ code: parseInt(line.slice(0, 3), 10), text: buffer.trim() })
          return
        }
      }
    }
    function onError(err: Error) { cleanup(); reject(err) }
    function cleanup() {
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
    }
    socket.on('data', onData)
    socket.once('error', onError)
  })
}

function cmd(socket: tls.TLSSocket, line: string) {
  socket.write(line + '\r\n')
}

export async function smtpSend({
  user,
  pass,
  to,
  subject,
  body,
}: {
  user: string
  pass: string
  to: string
  subject: string
  body: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' })
    socket.once('error', reject)

    ;(async () => {
      try {
        let res = await readResponse(socket)
        if (res.code !== 220) throw new Error(`Greeting error ${res.code}: ${res.text}`)

        cmd(socket, 'EHLO gmail.com')
        res = await readResponse(socket)
        if (res.code !== 250) throw new Error(`EHLO error ${res.code}: ${res.text}`)

        // AUTH PLAIN — format: \0user\0password, base64 encoded
        const auth = Buffer.from(`\0${user}\0${pass.replace(/\s/g, '')}`).toString('base64')
        cmd(socket, `AUTH PLAIN ${auth}`)
        res = await readResponse(socket)
        if (res.code !== 235) throw new Error(`Auth failed — check Gmail app password. ${res.code}: ${res.text}`)

        cmd(socket, `MAIL FROM:<${user}>`)
        res = await readResponse(socket)
        if (res.code !== 250) throw new Error(`MAIL FROM error ${res.code}: ${res.text}`)

        cmd(socket, `RCPT TO:<${to}>`)
        res = await readResponse(socket)
        if (res.code !== 250) throw new Error(`RCPT TO error ${res.code}: ${res.text}`)

        cmd(socket, 'DATA')
        res = await readResponse(socket)
        if (res.code !== 354) throw new Error(`DATA error ${res.code}: ${res.text}`)

        // Write the message — dots at start of line must be escaped
        const escaped = body.replace(/^\.$/gm, '..')
        const msg = [
          `From: Surefire Market <${user}>`,
          `To: ${to}`,
          ...(subject ? [`Subject: ${subject}`] : []),
          '',
          escaped,
          '.',
        ].join('\r\n')
        socket.write(msg + '\r\n')
        res = await readResponse(socket)
        if (res.code !== 250) throw new Error(`Message rejected ${res.code}: ${res.text}`)

        cmd(socket, 'QUIT')
        socket.end()
        resolve()
      } catch (err) {
        socket.destroy()
        reject(err)
      }
    })()
  })
}
