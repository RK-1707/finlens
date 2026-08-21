import { Card, SectionTitle } from '../components/Card';

export function Contact() {
  return <Card><SectionTitle title="Contact Us" aside="FinLens support" /><div className="contact-grid"><div className="contact-item"><div className="label">Email</div><a href="mailto:rohan.kumar9@adityabirlacapital.com">rohan.kumar9@adityabirlacapital.com</a></div><div className="contact-item"><div className="label">Phone</div><a href="tel:+919096073495">+91 90960 73495</a></div></div><div className="sub">For queries, feedback, or support related to FinLens.</div></Card>;
}
