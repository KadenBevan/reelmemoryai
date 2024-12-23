import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { styles } from './Testimonials.styles'

const testimonials = [
  {
    name: 'Alice Johnson',
    role: 'Professional Photographer',
    content: 'Reel Memory AI has revolutionized how I manage my vast photo collection. It\'s like having a personal assistant who knows exactly where every photo is!',
    avatar: '/placeholder.svg?height=40&width=40',
  },
  {
    name: 'Mark Thompson',
    role: 'Social Media Influencer',
    content: 'As someone who deals with hundreds of videos weekly, Reel Memory AI has been a game-changer. It\'s incredibly accurate and saves me hours of searching.',
    avatar: '/placeholder.svg?height=40&width=40',
  },
  {
    name: 'Sarah Lee',
    role: 'Digital Marketing Manager',
    content: 'The AI-powered search feature is mind-blowing. I can find any piece of content in seconds, making my job so much easier and more efficient.',
    avatar: '/placeholder.svg?height=40&width=40',
  },
]

export default function Testimonials() {
  return (
    <section className={styles.section} id="testimonials">
      <div className={styles.container}>
        <h2 className={styles.heading}>
          What Our Users Say
        </h2>
        <div className={styles.grid}>
          {testimonials.map((testimonial, index) => (
            <Card key={index} className={styles.card}>
              <CardContent className={styles.cardContent}>
                <div className={styles.avatarWrapper}>
                  <Avatar className={styles.avatar}>
                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                    <AvatarFallback>{testimonial.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className={styles.userInfo}>
                    <p className={styles.userName}>{testimonial.name}</p>
                    <p className={styles.userRole}>{testimonial.role}</p>
                  </div>
                </div>
                <p className={styles.testimonialText}>{testimonial.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

