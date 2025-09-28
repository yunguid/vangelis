export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    service: 'vangelis-frontend',
    timestamp: new Date().toISOString()
  });
}
