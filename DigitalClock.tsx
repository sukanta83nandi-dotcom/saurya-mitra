import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, TrendingDown, Award, Leaf, ArrowUpRight } from 'lucide-react';
import { Language, translations } from '../translations';

interface BusinessBenefitsProps {
  language: Language;
}

export function BusinessBenefits({ language }: BusinessBenefitsProps) {
  const t = translations[language];

  const benefits = [
    {
      title: t.benefit1Title,
      desc: t.benefit1Desc,
      icon: TrendingDown,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: t.benefit2Title,
      desc: t.benefit2Desc,
      icon: Award,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: t.benefit3Title,
      desc: t.benefit3Desc,
      icon: Leaf,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      title: t.benefit4Title,
      desc: t.benefit4Desc,
      icon: ArrowUpRight,
      color: 'bg-cyan-100 text-cyan-600',
    },
  ];

  return (
    <section className="py-10 md:py-20">
      <div className="flex flex-col items-center text-center space-y-4 mb-8 md:mb-16">
        <div className="p-3 bg-zinc-100 rounded-2xl">
          <Briefcase className="w-6 h-6 md:w-8 md:h-8 text-zinc-900" />
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{t.businessTitle}</h2>
        <p className="text-gray-500 max-w-2xl text-sm md:text-lg px-2">{t.businessDesc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {benefits.map((benefit, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            viewport={{ once: true }}
            className="p-6 md:p-8 bg-white rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
          >
            <div className={`w-12 h-12 md:w-14 md:h-14 ${benefit.color} rounded-xl md:rounded-2xl flex items-center justify-center mb-5 md:mb-6 group-hover:scale-110 transition-transform`}>
              <benefit.icon className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 md:mb-3">{benefit.title}</h3>
            <p className="text-gray-500 text-sm md:text-base leading-relaxed">{benefit.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
