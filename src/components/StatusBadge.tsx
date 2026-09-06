import { CircleCheck, CircleDot, Clock3, Wrench } from 'lucide-react'
import { motion } from 'framer-motion'
import type { OperationalStatus } from '../types'

interface Props {
  status: OperationalStatus
}

export default function StatusBadge({ status }: Props) {
  if (status === 'MAINTENANCE') return <motion.span layout className="badge maintenance" initial={{opacity:0,scale:.92}} animate={{opacity:1,scale:1}}><Wrench/>Manutenção</motion.span>
  if (status === 'IN_TRANSIT') return (
    <motion.span layout className="badge transit" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }}>
      <motion.span className="badge-icon-wrap" animate={{ opacity: [1, .35, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
        <CircleDot/>
      </motion.span>
      Em movimento
    </motion.span>
  )
  if (status === 'COMMITTED') return <motion.span layout className="badge committed" initial={{opacity:0,scale:.92}} animate={{opacity:1,scale:1}}><Clock3/>Empenhado</motion.span>
  return <motion.span layout className="badge available" initial={{opacity:0,scale:.92}} animate={{opacity:1,scale:1}}><CircleCheck/>Disponível</motion.span>
}
